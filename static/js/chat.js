// chat.js (Version with unified history, Stateless API and debug history window)
if (window.appConfig && window.appConfig.isHostSet) {
    const chatForm = document.getElementById('chatForm');
    const userInput = document.getElementById('userInput');
    const chatBox = document.getElementById('chatBox');
    const submitBtn = document.getElementById('submitBtn');
    const modelSelect = document.getElementById('modelSelect');
    const modelSelect2 = document.getElementById('modelSelect2'); 
    const statusArea = document.getElementById('statusArea');
    const startLoopBtn = document.getElementById('startLoopBtn');
    const stopLoopBtn = document.getElementById('stopLoopBtn');
    const turnLimitInput = document.getElementById('turnLimitInput');
    const systemPrompt1Textarea = document.getElementById('systemPrompt1');
    const systemPrompt2Textarea = document.getElementById('systemPrompt2');
    const saveBtn1 = document.getElementById('saveBtn1'); 
    const saveBtn2 = document.getElementById('saveBtn2');
    // NEW CONSTANT FOR THE LOG AREA
    const jsLogArea = document.getElementById('jsLogArea');

    // MAIN CHANGE: ONE COMMON HISTORY
    let conversationHistory = [];
    let isLooping = false;

    function formatMessage(text) { return marked.parse(text); }
    function updateStatus(message) { if (statusArea) { statusArea.textContent = 'Status: ' + message; } }

    // NEW FUNCTION TO DISPLAY HISTORY FOR DEBUGGING
    function displayDebugHistory() {
        if (!jsLogArea) return;

        jsLogArea.innerHTML = ''; // Clear old logs

        conversationHistory.forEach((message, index) => {
            const entry = document.createElement('div');
            entry.classList.add('log-entry');
            
            let logContent = `[Turn ${index}] `;
            
            if (message.role === 'user') {
                logContent += `USER (Input): ${message.content.substring(0, 50)}...`;
                entry.style.color = 'blue';
            } else {
                const modelDisplay = `${message.role} (${message.modelName})`;
                logContent += `${modelDisplay}: ${message.content.substring(0, 50)}...`;
                entry.style.color = (message.role === 'model_1' ? 'green' : 'darkblue');

                if (message.systemPrompt) {
                    const promptDetails = document.createElement('div');
                    promptDetails.textContent = `  Prompt: "${message.systemPrompt.substring(0, 50)}..."`;
                    promptDetails.classList.add('prompt-details');
                    entry.appendChild(promptDetails);
                }
            }
            
            const contentSpan = document.createElement('span');
            contentSpan.textContent = logContent;
            entry.insertBefore(contentSpan, entry.firstChild);

            jsLogArea.appendChild(entry);
        });
        jsLogArea.scrollTop = jsLogArea.scrollHeight;
    }


    updateStatus("Application loaded. Waiting for the first message.");

    window.setModel = function(modelName, modelId) {
         fetch('/set_model', { 
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ model: modelName, model_id: modelId }),
         });
         submitBtn.disabled = false;
         userInput.disabled = false;
         updateStatus(`Model ${modelId} changed to ${modelName}. The new model will be used in the next round.`);
    }

    // --- PROMPT HIDING/SHOWING LOGIC (UI only functionality) ---
    function togglePromptUI(modelId, hideMode) {
        const textarea = (modelId === 'model_1') ? systemPrompt1Textarea : systemPrompt2Textarea;
        const button = (modelId === 'model_1') ? saveBtn1 : saveBtn2;
        if (hideMode) {
            textarea.classList.add('hidden');
            button.textContent = 'Prompt';
        } else {
            textarea.classList.remove('hidden');
            button.textContent = 'Hide Prompt';
        }
    }
    saveBtn1.addEventListener('click', (e) => {
        e.preventDefault(); 
        const isHidden = systemPrompt1Textarea.classList.contains('hidden');
        togglePromptUI('model_1', !isHidden);
    });
    saveBtn2.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = systemPrompt2Textarea.classList.contains('hidden');
        togglePromptUI('model_2', !isHidden);
    });
    // --- END OF PROMPT HIDING LOGIC ---

    // --- CHAT FORM SUBMISSION HANDLER ---
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (submitBtn.disabled) {
            // Updated message
            logMessage("Attempted resubmission blocked.", 'gray'); 
            return; 
        }
        
        const userMessage = userInput.value;
        if (userMessage.trim() === '') return;

        if (conversationHistory.length === 0) {
            addMessage('user', userMessage); 
            // UPDATED HISTORY OBJECT STRUCTURE (first user message)
            conversationHistory.push({ 
                role: 'user', 
                content: userMessage,
                modelName: null,
                systemPrompt: null
            });
            displayDebugHistory(); // <-- Call here
        } else {
            return; 
        }

        userInput.value = '';
        
        submitBtn.disabled = true; 
        userInput.disabled = true;

        // Updated message
        updateStatus("Executing manual dialog turn (Sequential mode)...");
        await runSingleDialogTurn(); // Renamed function call

        submitBtn.disabled = false;
        userInput.disabled = false;
        // Updated message
        updateStatus("Manual turn finished. You can continue manually or start the loop.");
    });
    
    
        // --- AUTO-DIALOG LOGIC ---
    startLoopBtn.addEventListener('click', async () => {
        if (conversationHistory.length === 0) {
             // Updated message
             updateStatus("Please send the first message manually to start the dialog first.");
             return;
        }
        
        isLooping = true;
        startLoopBtn.disabled = true;
        stopLoopBtn.disabled = false;
        userInput.disabled = true;
        submitBtn.disabled = true;
        turnLimitInput.disabled = true;

        const maxTurns = parseInt(turnLimitInput.value) || 3;
        // Updated message
        updateStatus(`Automatic dialog loop started for ${maxTurns} turns.`);

        for (let i = 0; i < maxTurns; i++) {
            if (!isLooping) { break; }
            // Updated message
            updateStatus(`Automatic turn ${i + 1}/${maxTurns}...`);
            await runSingleDialogTurn(); // Function call renamed
        }

        isLooping = false;
        startLoopBtn.disabled = false;
        stopLoopBtn.disabled = true;
        userInput.disabled = false;
        submitBtn.disabled = false;
        turnLimitInput.disabled = false;
        // Updated message
        updateStatus("Dialog loop finished.");
    });
    
    stopLoopBtn.addEventListener('click', () => {
        // Updated message
        isLooping = false;
        updateStatus("Stopping loop after the current round finishes.");
    });
    
     // --- MAIN LOGIC FOR SEQUENTIAL MODEL EXECUTION ---
     // Function name renamed: runSingleDebateTurn -> runSingleDialogTurn
     async function runSingleDialogTurn() {
         const modelName1 = modelSelect.value;
         const modelName2 = modelSelect2.value;
         
         const promptM1 = systemPrompt1Textarea.value;
         const promptM2 = systemPrompt2Textarea.value;
     
         const labelM1 = document.getElementById('labelModel1').textContent.replace(':', '').trim();
         const labelM2 = document.getElementById('labelModel2').textContent.replace(':', '').trim();
     
         // --- STEP 1: M1 responds ---
         // Updated message
         updateStatus("runSingleDialogTurn: M1 responding.");
         await generateResponseForModel(modelName1, labelM1, 'ai-model1', 'model_1', promptM1);
         
         // --- STEP 2: M2 responds ---
         // Updated message
         updateStatus("runSingleDialogTurn: M2 responding.");
         await generateResponseForModel(modelName2, labelM2, 'ai-model2', 'model_2', promptM2);
     
         if (!isLooping && startLoopBtn.disabled) {
             // Updated message
             logMessage("isLooping=false detected after M2. Round finished, next one will not start.", 'orange');
             return; 
         }
     
         // Updated message
         updateStatus("runSingleDialogTurn: Round finished. Models synchronized.");
     }

    // !!! NEW HISTORY TRANSFORMATION FUNCTION !!!
    // The logic inside this function already uses English terms (role: 'user', role: 'assistant') 
    // so it doesn't need linguistic translation, only function name alignment if needed.
    function transformHistory(targetModelId, systemPrompt) {
        const transformedMessages = [];
        
        if (systemPrompt) {
            transformedMessages.push({ role: 'system', content: systemPrompt });
        }

        for (const message of conversationHistory) {
            if (message.role === targetModelId) {
                transformedMessages.push({ role: 'assistant', content: message.content });
            } else {
                transformedMessages.push({ role: 'user', content: message.content });
            }
        }
        return transformedMessages;
    }

    // !!! UPDATED GENERATERESPONSEFORMODEL FUNCTION FOR STATELESS API!!!
    async function generateResponseForModel(modelName, senderLabel, modelClass, modelIdentifier, systemPrompt = "") {
        
        const aiMessageElements = addMessage('ai', '', true, senderLabel, modelClass, modelName); 
        const aiContentDiv = aiMessageElements.content;
        const aiThoughtDiv = aiMessageElements.thought;
        let fullAiResponseContent = ''; 

        const messagesToSend = transformHistory(modelIdentifier, systemPrompt);

        try {
            const response = await fetch(`/chat`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messages: messagesToSend,
                    target_model_name: modelName, 
                    target_model_id: modelIdentifier
                }),
            });
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value);
                let lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.trim() === '' && fullAiResponseContent.slice(-1) !== '\n') {
                        fullAiResponseContent += '\n';
                    }

                    if (line.startsWith('[THINKING]')) {
                        const thoughtText = line.substring('[THINKING]'.length);
                        aiThoughtDiv.style.display = 'block';
                        aiThoughtDiv.textContent += thoughtText;
                    } 
                    else if (line.startsWith('[CONTENT]')) {
                        const text = line.substring('[CONTENT]'.length);
                        fullAiResponseContent += text;                        
                        aiContentDiv.innerHTML = formatMessage(fullAiResponseContent); 
                    } else if (line.startsWith('[ERROR]')) { 
                        const errorText = line.substring('[ERROR]'.length);
                        // Updated message
                        logMessage(`Error: ${errorText}`, 'red'); 
                        aiContentDiv.textContent = 'Error: ' + errorText;
                        break; 
                    }
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            }
            
            aiContentDiv.parentElement.classList.remove('loading');
            
            if (fullAiResponseContent.length === 0) {
                 // Updated message
                 aiContentDiv.textContent = '(Empty response)';
            } else {
                 // ADDING RESPONSE TO THE UNIFIED HISTORY WITH CORRECT MODEL ROLE AND ADDITIONAL DATA
                 conversationHistory.push({ 
                    role: modelIdentifier, 
                    content: fullAiResponseContent,
                    modelName: modelName,     
                    systemPrompt: systemPrompt
                 });
                 displayDebugHistory(); // <-- Call here
            }

        } catch (error) {
            // Updated message
            logMessage(`Critical fetch error for ${modelIdentifier}: ${error.message}`, 'red');
            // Updated message
            aiContentDiv.textContent = 'Connection Error: ' + error.message;
            aiContentDiv.parentElement.classList.remove('loading');
        } finally {
            aiThoughtDiv.style.display = 'none'; 
            aiThoughtDiv.textContent = '';
        }
    }

    
    // --- ADD MESSAGE FUNCTION ---
    function addMessage(sender, text, isLoading = false, senderLabel = null, modelClass = null, modelName = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        if (isLoading) {
            messageDiv.classList.add('loading');
        }
        if (modelClass) {
            messageDiv.classList.add(modelClass);
        }
        
        const senderSpan = document.createElement('span');
        senderSpan.classList.add('sender-label');
        
        // LOGIC FIX: Removed duplicate textContent call
        if (sender === 'user') {
            senderSpan.textContent = 'You'; // Changed from 'Вы' to 'You'
        } else {
            const modelInfo = modelName ? ` (${modelName})` : ''; 
            senderSpan.textContent = `${senderLabel || 'AI'}${modelInfo}`; 
        }
        // END OF FIX

        messageDiv.appendChild(senderSpan);
        
        const thoughtDiv = document.createElement('div');
        thoughtDiv.classList.add('thought');
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('content');
        contentDiv.innerHTML = formatMessage(text); 
        
        messageDiv.appendChild(thoughtDiv);
        messageDiv.appendChild(contentDiv);
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        return { container: messageDiv, thought: thoughtDiv, content: contentDiv };
    }

    document.addEventListener('DOMContentLoaded', (event) => { });
}
