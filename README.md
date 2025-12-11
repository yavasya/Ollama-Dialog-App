# Ollama Flask Chat Comparator (Ollama-Dialog-App)

A simple web interface built with Flask and Python for comparing the output of two different Ollama language models in a side-by-side or automated dialog format.

This project allows you to quickly switch between models, configure unique system prompts for each, and initiate an automated turn-based conversation between the two AI models.

## Features

*   **Model Comparison:** Run inputs through two distinct models sequentially.
*   **Flexible Real-time Configuration:** The Ollama server address, as well as **models and system prompts, can be changed "on the fly" during the current conversation** via the web interface, without restarting the application.
*   **Automated Dialog:** Initiate an automated turn-based conversation ("dialog") between the two selected models for stress-testing or amusement.
*   **Debug Logging:** A real-time log window in the sidebar shows the exact messages and prompts being sent to the Ollama server.

## Prerequisites

Before running this application, you must have:

1.  **Python 3.x** installed.
2.  **Ollama** installed and running on your network.
3.  Ensure your Ollama server is configured to listen on your network interface (e.g., `OLLAMA_HOST=0.0.0.0:11434`).

## Installation and Usage

1.  **Clone the repository** (once it's on GitHub):

    ```bash
    git clone github.com
    cd Ollama-Dialog-App
    ```

2.  **Install Python dependencies:**

    ```bash
    pip install flask ollama markdown
    ```

3.  **Run the Flask application:**

    ```bash
    python app.py
    ```

4.  **Open your browser** and navigate to `http://127.0.0.1:5000`.

5.  **Configure the Ollama Host:** Enter the address of your running Ollama server in the input field.

## Project Structure

.
├── app.py # Main Flask application logic
├── templates/
│ └── template.html # Main UI template (Jinja2)
└── static/
├── css/
│ └── style.css # Styling for the interface
├── js/
│ ├── chat.js # Frontend JavaScript logic (chat, loops, status)
│ └── marked.min.js # Library for rendering Markdown
└── ...
