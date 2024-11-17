/**
 * Captures audio from the active tab in Google Chrome.
 * @returns {Promise<MediaStream>} A promise that resolves with the captured audio stream.
 */
function captureTabAudio() {
  return new Promise((resolve) => {
    chrome.tabCapture.capture(
      {
        audio: true,
        video: false,
      },
      (stream) => {
        resolve(stream);
      }
    );
  });
}

/**
 * Sends a message to a specific tab in Google Chrome.
 * @param {number} tabId - The ID of the tab to send the message to.
 * @param {any} data - The data to be sent as the message.
 * @returns {Promise<any>} A promise that resolves with the response from the tab.
 */
function sendMessageToTab(tabId, data) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, data, (response) => {
      resolve(response);
    });
  });
}

/**
 * Resamples the audio data to a target sample rate of 16kHz.
 * @param {Array|ArrayBuffer|TypedArray} audioData - The input audio data.
 * @param {number} [origSampleRate=44100] - The original sample rate of the audio data.
 * @returns {Float32Array} The resampled audio data at 16kHz.
 */
function resampleTo16kHZ(audioData, origSampleRate = 44100) {
  // Convert the audio data to a Float32Array
  const data = new Float32Array(audioData);

  // Calculate the desired length of the resampled data
  const targetLength = Math.round(data.length * (16000 / origSampleRate));

  // Create a new Float32Array for the resampled data
  const resampledData = new Float32Array(targetLength);

  // Calculate the spring factor and initialize the first and last values
  const springFactor = (data.length - 1) / (targetLength - 1);
  resampledData[0] = data[0];
  resampledData[targetLength - 1] = data[data.length - 1];

  // Resample the audio data
  for (let i = 1; i < targetLength - 1; i++) {
    const index = i * springFactor;
    const leftIndex = Math.floor(index).toFixed();
    const rightIndex = Math.ceil(index).toFixed();
    const fraction = index - leftIndex;
    resampledData[i] = data[leftIndex] + (data[rightIndex] - data[leftIndex]) * fraction;
  }

  // Return the resampled data
  return resampledData;
}

function generateUUID() {
  let dt = new Date().getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
}

async function startRecord(option) {
  const stream = await captureTabAudio();
  const uuid = generateUUID();

  if (stream) {
    stream.oninactive = () => {
      window.close();
    };

    // Modified WebSocket connection for Rev AI
    const socket = new WebSocket(
      `wss://api.rev.ai/speechtotext/v1/stream?` +
      `access_token=${'02YNHWnpptcf8S8gntcfKVdpO9aIMtTm1D2guAlsSzEJRbKZF0CGU7gIJsgHnY6nI4yi230f1wKfPFgaqo6jV4VQLOgC8'}&` +
      `content_type=audio/x-raw;layout=interleaved;rate=16000;format=S16LE;channels=1`
      );

    console.log('WebSocket connection created');

    let isServerReady = false;

    socket.onopen = function(e) {
        isServerReady = true;
        console.log('WebSocket connection opened');
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
    
      if (data.type === "partial" || data.type === "final") {
        const transcribedText = data.elements.map(element => element.value).join(" ");
        // console.log("Transcribed text:", transcribedText);
        
        // Send to both the transcription UI and ChatGPT tab
        updateTranscriptionUI(transcribedText);
        
        // Send message to ChatGPT tab
        const tabs = await chrome.tabs.query({url: "*://chatgpt.com/*"}); // Updated URL pattern
        console.log("Found ChatGPT tabs:", tabs);
        
        if (tabs.length > 0) {
          try {
            console.log("Sending message to tab:", tabs[0].id); // Debug log
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
              type: "updateChatGPT",
              text: transcribedText
            });
            
            console.log("Response from content script:", response); // Debug log
            
            if (response && response.success) {
              console.log("Successfully updated ChatGPT textarea");
            } else {
              console.error("Failed to update textarea:", response?.error);
            }
          } catch (error) {
            console.error("Error sending message to ChatGPT tab:", error);
          }
        } else {
          console.log("No ChatGPT tabs found. Active URLs:", tabs.map(t => t.url));
        }
      }
    };

    const audioDataCache = [];
    const context = new AudioContext();
    const mediaStream = context.createMediaStreamSource(stream);
    const recorder = context.createScriptProcessor(4096, 1, 1);

    recorder.onaudioprocess = async (event) => {
      if (!context || !isServerReady) return;
      
      const inputData = event.inputBuffer.getChannelData(0);
      const audioData16kHz = resampleTo16kHZ(inputData, context.sampleRate);
      
      // Convert Float32Array to Int16Array
      const audioDataInt16 = new Int16Array(audioData16kHz.length);
      for (let i = 0; i < audioData16kHz.length; i++) {
        const s = Math.max(-1, Math.min(1, audioData16kHz[i]));
        audioDataInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      audioDataCache.push(inputData);
      socket.send(audioDataInt16.buffer);
      // console.log('Audio data sent to server');
    };
    mediaStream.connect(recorder);
    recorder.connect(context.destination);
    mediaStream.connect(context.destination);
  } else {
    window.close();
  }
}

/**
 * Listener for incoming messages from the extension's background script.
 * @param {Object} request - The message request object.
 * @param {Object} sender - The sender object containing information about the message sender.
 * @param {Function} sendResponse - The function to send a response back to the message sender.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, data } = request;

  switch (type) {
    case "start_capture":
      startRecord(data);
      break;
    default:
      break;
  }

  // sendResponse({});
  return true;
});

function updateTranscriptionUI(text) {
  const transcriptionContainer = document.getElementById("transcription-container");
  transcriptionContainer.textContent = text;
}