# app.py

from flask import Flask, request, jsonify, render_template, session, redirect, url_for, flash, Response
import ollama
import os
import json 
import time
from urllib.parse import urlparse

app = Flask(__name__)
app.secret_key = os.urandom(24) 

DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434' 

# ANSI Color Codes
class Colors:
    GREEN = '\033[92m'
    BLUE = '\033[94m'
    WARNING = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'

def get_available_models(host_url):
    try:
        client = ollama.Client(host=host_url)
        response = client.list()
        models = []
        if 'models' in response and isinstance(response['models'], list): # Use dict access as ollama client returns dict
            for model_data in response['models']:
                if 'model' in model_data:
                    models.append(model_data['model'])
        return models

    except Exception as e:
        print(f"DEBUG: Исключение при попытке получить модели: {str(e)}")
        raise e

@app.route('/')
def index():
    if not session.get('ollama_host'):
        instruction_message = ("⚠️ Инструкция: Убедитесь, что ваш сервер Ollama настроен слушать 0.0.0.0. Используйте команду 'sudo systemctl edit ollama.service' и добавьте Environment=\"OLLAMA_HOST=0.0.0.0:11434\", затем перезапустите сервис.")
        flash(instruction_message)
        return render_template("template.html", default_host=DEFAULT_OLLAMA_HOST)
    
    return render_template("template.html")

@app.route('/set_host', methods=['POST'])
def set_host():
    host_url = request.form['host_url']
    if host_url:
        session.pop('ollama_host', None)
        session.pop('available_models', None)
        session.pop('model_1', None)
        session.pop('model_2', None)
        session.pop('system_prompt_1_text', None)
        session.pop('system_prompt_2_text', None)
        try:
            models = get_available_models(host_url)
            if models:
                session['ollama_host'] = host_url
                session['available_models'] = models
                session['model_1'] = models[0]
                session['model_2'] = models[0]
            else:
                flash(f"⚠️ Сервер ответил, но список моделей пуст.")
                return redirect(url_for('index'))
        except Exception as e:
            flash(f"❌ Ошибка подключения: {str(e)}")
            return redirect(url_for('index'))
    return redirect(url_for('index'))

@app.route('/set_model', methods=['POST'])
def set_model():
    data = request.get_json()
    model_name = data.get('model')
    model_id = data.get('model_id')
    if model_name in session.get('available_models', []) and model_id in ['model_1', 'model_2']:
        session[model_id] = model_name
        return jsonify({"status": f"Model {model_id} updated", "model": model_name})
    return jsonify({"status": "Invalid model or model ID"}), 400

@app.route('/reset_host')
def reset_host():
    session.pop('ollama_host', None)
    session.pop('available_models', None)
    session.pop('model_1', None)
    session.pop('model_2', None)
    session.pop('system_prompt_1_text', None)
    session.pop('system_prompt_2_text', None)
    flash("Адрес сервера Ollama сброшен. Введите новый адрес.")
    return redirect(url_for('index'))

@app.route('/debug_session')
def debug_session():
    return jsonify(dict(session))

@app.route('/chat', methods=['POST'])
def chat():
    host_url = session.get('ollama_host')
    
    # !!! ИСПРАВЛЕНИЕ: Читаем model_id и model_name из JSON тела запроса !!!
    data = request.get_json()
    messages = data.get('messages', [])
    model_id = data.get('target_model_id')   # Читаем из JSON (это 'model_1' или 'model_2')
    model_name = data.get('target_model_name') # Читаем из JSON (это 'phi3:mini' или 'llama3')
    # !!! Конец исправления !!!

    if not host_url or not model_name:
        # Улучшенное сообщение об ошибке, если что-то не так с данными из JS
        print(f"{Colors.RED}DEBUG: Ошибка конфигурации хоста или модели: host_url={host_url}, model_name={model_name}{Colors.ENDC}")
        return jsonify({"error": "Ollama host or model is not configured"}), 400
    
    # system_prompt теперь просто игнорируется, так как не используется во Flask

    color = Colors.WARNING 
    if model_id == 'model_1':
        color = Colors.GREEN
    elif model_id == 'model_2':
        color = Colors.BLUE
        
    print(f"{color}\n--- Запрос CHAT: ID={model_id} -> '{model_name}' ---{Colors.ENDC}")
    # *** НОВЫЙ ОТЛАДОЧНЫЙ ВЫВОД: ***
    print(f"{color}DEBUG: Получено сообщений в истории от JS: {len(messages)} шт.{Colors.ENDC}")


    def generate_stream(current_messages, current_model, current_host, current_system_prompt=""): # current_system_prompt теперь опционален
        chars_sent = 0
        try:
            client = ollama.Client(host=current_host)
            final_messages_list = []
            
            final_messages_list.extend(current_messages)
            
            # Отладочный вывод для промпта
            if final_messages_list and final_messages_list[0].get('role') == 'system':
                print(f"{color}DEBUG: Используется System Prompt: \"{final_messages_list[0].get('content')[:100]}...\" {Colors.ENDC}")
            
            # *** НОВЫЙ ОТЛАДОЧНЫЙ ВЫВОД: ***
            print(f"{color}DEBUG: Отправляю в ollama.chat() итого: {len(final_messages_list)} сообщений.{Colors.ENDC}")

            stream = client.chat(model=current_model, messages=final_messages_list, stream=True)
            first_chunk_received = False 
            
            for chunk in stream:
                content_text = chunk.get('message', {}).get('content', '')
                if content_text and not first_chunk_received:
                    log_message = f"\"{current_model} {current_host} {content_text.strip()[:50]}...\"" # Обрезаем для лога
                    print(f"{Colors.WARNING}{log_message}{Colors.ENDC}")
                    first_chunk_received = True

                thinking_text = chunk.get('message', {}).get('thinking', '')
                if thinking_text:
                    output = f"[THINKING]{thinking_text}\n"
                    chars_sent += len(output)
                    yield output
                if content_text:
                    output = f"[CONTENT]{content_text}\n"
                    chars_sent += len(output)
                    yield output
        except Exception as e:
            error_msg = f"Connection failed: {str(e)}"
            print(f"{Colors.RED}DEBUG: Ошибка в generate_stream для {model_name}: {error_msg}{Colors.ENDC}")
            yield f"[ERROR]{error_msg}\n"
        finally:
            print(f"{Colors.BLUE}DEBUG FLASK STREAM: Всего отправлено символов для {model_id}: {chars_sent}{Colors.ENDC}")

    return Response(generate_stream(messages, model_name, host_url), mimetype='text/plain')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
