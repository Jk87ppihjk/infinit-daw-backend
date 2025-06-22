// app/js/audio-recorder-processor.js

class AudioRecorderProcessor extends AudioWorkletProcessor {
  /**
   * O método process é chamado para cada bloco de áudio.
   * Ele envia os dados de áudio crus (samples) de volta para a thread principal.
   */
  process(inputs) {
    // Pegamos o primeiro input, que é o microfone.
    const input = inputs[0];
    
    // Gravamos em mono, então pegamos apenas o primeiro canal.
    const channelData = input[0];

    // Se houver dados de áudio, envia uma cópia para a thread principal.
    if (channelData) {
      this.port.postMessage(channelData.slice(0));
    }

    // Retorna true para manter o processador ativo.
    return true;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);