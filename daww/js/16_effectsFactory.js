/**
 * Gera uma Impulse Response (IR) simples para um ConvolverNode.
 * Esta função agora está disponível globalmente para qualquer efeito.
 * @param {AudioContext} audioContext - O AudioContext.
 * @param {number} duration - Duração total da IR em segundos.
 * @param {number} decayRate - Taxa de decaimento (maior = mais rápido o decaimento).
 * @returns {AudioBuffer} O AudioBuffer contendo a IR.
 */
function generateImpulseResponse(audioContext, duration, decayRate) {
    const sampleRate = audioContext.sampleRate;
    // Garante que a duração seja um número válido para evitar erros
    const validDuration = typeof duration === 'number' && duration > 0 ? duration : 0.1;
    const length = sampleRate * validDuration;
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        // Ruído branco com decaimento exponencial
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - (i / length), decayRate);
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - (i / length), decayRate);
    }
    return impulse;
}


/**
 * Cria e configura os nós de áudio (AudioNodes) para uma instância de efeito específica.
 * Retorna um objeto com os nós e uma função para atualizá-los.
 */
function createEffectNode(effectInstance) {
    const audioContext = APP_STATE.audioContext;
    if (!audioContext) return null;

    const effectId = effectInstance.effectId;
    const effectDef = APP_STATE.allEffects.find(def => def.id === effectId);
    if (!effectDef) {
        console.error(`Definição do efeito ${effectId} não encontrada.`);
        return null;
    }

    switch (effectId) {
        
        case 'precision_eq': {
            const inputNode = audioContext.createGain();
            const outputNode = audioContext.createGain();
            
            // Cria os 4 filtros (bandas) e o analisador de espectro
            const band1 = audioContext.createBiquadFilter();
            const band2 = audioContext.createBiquadFilter();
            const band3 = audioContext.createBiquadFilter();
            const band4 = audioContext.createBiquadFilter();
            const analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 2048; // Define a resolução do analisador

            // Conecta tudo em série: Som entra -> Filtros -> Analisador -> Saída
            inputNode.connect(band1);
            band1.connect(band2);
            band2.connect(band3);
            band3.connect(band4);
            band4.connect(analyserNode);
            analyserNode.connect(outputNode);

            const update = (newParams) => {
                // Configura a Banda 1 (Low Shelf)
                band1.type = newParams.band1_type;
                band1.frequency.setTargetAtTime(newParams.band1_freq, audioContext.currentTime, 0.01);
                band1.gain.setTargetAtTime(newParams.band1_gain, audioContext.currentTime, 0.01);

                // Configura a Banda 2 (Low-Mid Peaking)
                band2.type = newParams.band2_type;
                band2.frequency.setTargetAtTime(newParams.band2_freq, audioContext.currentTime, 0.01);
                band2.gain.setTargetAtTime(newParams.band2_gain, audioContext.currentTime, 0.01);
                band2.Q.setTargetAtTime(newParams.band2_q, audioContext.currentTime, 0.01);
                
                // Configura a Banda 3 (High-Mid Peaking)
                band3.type = newParams.band3_type;
                band3.frequency.setTargetAtTime(newParams.band3_freq, audioContext.currentTime, 0.01);
                band3.gain.setTargetAtTime(newParams.band3_gain, audioContext.currentTime, 0.01);
                band3.Q.setTargetAtTime(newParams.band3_q, audioContext.currentTime, 0.01);
                
                // Configura a Banda 4 (High Shelf)
                band4.type = newParams.band4_type;
                band4.frequency.setTargetAtTime(newParams.band4_freq, audioContext.currentTime, 0.01);
                band4.gain.setTargetAtTime(newParams.band4_gain, audioContext.currentTime, 0.01);
            };

            update(effectInstance.parameters);

            return {
                input: inputNode,
                output: outputNode,
                nodes: [inputNode, outputNode, band1, band2, band3, band4, analyserNode],
                analyserNode: analyserNode, // Disponibiliza o analisador para a UI
                update: update,
            };
        }

        case 'ethereal_shimmer': {
            const inputGain = audioContext.createGain();
            const outputGain = audioContext.createGain();
            const dryGain = audioContext.createGain();
            const wetGain = audioContext.createGain();
            
            const convolverNode = audioContext.createConvolver();
            const decayGain = audioContext.createGain(); 
            
            const shimmerPanner = audioContext.createStereoPanner();
            const shimmerDelay = audioContext.createDelay(0.5);
            const shimmerFeedback = audioContext.createGain();
            const shimmerLFO = audioContext.createOscillator();
            const shimmerLFOGain = audioContext.createGain();
            const toneFilter = audioContext.createBiquadFilter();

            inputGain.connect(dryGain);
            dryGain.connect(outputGain);
            
            inputGain.connect(convolverNode);
            
            convolverNode.connect(decayGain);
            decayGain.connect(shimmerPanner);
            decayGain.connect(wetGain);

            shimmerPanner.connect(shimmerDelay);
            shimmerDelay.connect(shimmerFeedback);
            shimmerFeedback.connect(toneFilter);
            toneFilter.connect(shimmerDelay); 
            
            shimmerFeedback.connect(decayGain); 
            
            shimmerLFO.connect(shimmerLFOGain);
            shimmerLFOGain.connect(shimmerDelay.delayTime);
            shimmerLFO.type = 'sine';
            shimmerLFO.start(0);

            wetGain.connect(outputGain);
            
            const update = (newParams) => {
                dryGain.gain.setTargetAtTime(1.0 - newParams.mix, audioContext.currentTime, 0.02);
                wetGain.gain.setTargetAtTime(newParams.mix, audioContext.currentTime, 0.02);

                if (convolverNode.buffer === null || convolverNode.buffer.duration.toFixed(1) !== newParams.decay.toFixed(1)) {
                    convolverNode.buffer = generateImpulseResponse(audioContext, newParams.decay, 2);
                }
                
                decayGain.gain.setTargetAtTime(newParams.shimmer_amount, audioContext.currentTime, 0.02);
                shimmerFeedback.gain.setTargetAtTime(0.6 * newParams.shimmer_amount, audioContext.currentTime, 0.02);
                
                let pitchValue = 1200; 
                if (newParams.shimmer_pitch === '+2 Oitavas') pitchValue = 2400;
                if (newParams.shimmer_pitch === '+5 Semitons') pitchValue = 500;
                
                shimmerLFO.frequency.setTargetAtTime(pitchValue / 100, audioContext.currentTime, 0.02);
                shimmerLFOGain.gain.setTargetAtTime(0.005, audioContext.currentTime, 0.01);

                toneFilter.type = 'lowpass';
                toneFilter.frequency.setTargetAtTime(newParams.tone, audioContext.currentTime, 0.02);
            };

            update(effectInstance.parameters);

            return {
                input: inputGain,
                output: outputGain,
                nodes: [inputGain, outputGain, dryGain, wetGain, convolverNode, decayGain, shimmerPanner, shimmerDelay, shimmerFeedback, shimmerLFO, shimmerLFOGain, toneFilter],
                update: update
            };
        }

        case 'parametric_eq': {
            const inputNode = audioContext.createGain();
            const outputNode = audioContext.createGain();
            const effectNodeObject = {
                input: inputNode,
                output: outputNode,
                nodes: [inputNode, outputNode],
                update: null
            };
            let bandNodes = [];
            const update = (newBandsParameters) => {
                inputNode.disconnect();
                bandNodes.forEach(node => node.disconnect());
                bandNodes = newBandsParameters.map(bandData => {
                    const filterNode = audioContext.createBiquadFilter();
                    filterNode.type = bandData.type || 'peaking';
                    filterNode.frequency.setTargetAtTime(bandData.freq, audioContext.currentTime, 0.01);
                    filterNode.gain.setTargetAtTime(bandData.gain, audioContext.currentTime, 0.01);
                    filterNode.Q.setTargetAtTime(bandData.q, audioContext.currentTime, 0.01);
                    return filterNode;
                });
                let lastNode = inputNode;
                bandNodes.forEach(filterNode => {
                    lastNode.connect(filterNode);
                    lastNode = filterNode;
                });
                lastNode.connect(outputNode);
                effectNodeObject.nodes = [inputNode, outputNode, ...bandNodes];
            };
            effectNodeObject.update = update;
            effectNodeObject.update(effectInstance.parameters);
            return effectNodeObject;
        }

        case 'graphic_eq': {
            const inputNode = audioContext.createGain();
            const outputNode = audioContext.createGain();
            
            const bandParamDefs = effectDef.parameters; 
            
            const bandNodes = bandParamDefs.map(paramDef => {
                const filter = audioContext.createBiquadFilter();
                filter.type = 'peaking';
                const freqString = paramDef.name.toLowerCase();
                let freqValue;
                if (freqString.includes('k')) {
                    freqValue = parseFloat(freqString.replace('khz', '').replace('k', '')) * 1000;
                } else {
                    freqValue = parseFloat(freqString.replace('hz', ''));
                }
                filter.frequency.value = freqValue;
                filter.Q.value = 4.31;
                filter.gain.value = effectInstance.parameters[paramDef.id] || paramDef.defaultValue;
                return filter;
            });

            if (bandNodes.length > 0) {
                let lastNode = inputNode;
                bandNodes.forEach(node => {
                    lastNode.connect(node);
                    lastNode = node;
                });
                lastNode.connect(outputNode);
            } else {
                inputNode.connect(outputNode);
            }

            const update = (newParams) => {
                bandNodes.forEach((node, index) => {
                    const paramId = bandParamDefs[index].id;
                    const newGain = newParams[paramId];
                    if (typeof newGain !== 'undefined') {
                        node.gain.setTargetAtTime(newGain, audioContext.currentTime, 0.015);
                    }
                });
            };

            update(effectInstance.parameters);

            return {
                input: inputNode,
                output: outputNode,
                nodes: [inputNode, outputNode, ...bandNodes],
                update: update, 
            };
        }

        case 'infinitFilter': {
            const inputNode = audioContext.createGain();
            const outputNode = audioContext.createGain();
            const dryGain = audioContext.createGain();
            const wetGain = audioContext.createGain();
            const filterNode = audioContext.createBiquadFilter();
            const lfoNode = audioContext.createOscillator();
            const lfoDepthGain = audioContext.createGain();
            inputNode.connect(filterNode);
            filterNode.connect(wetGain);
            inputNode.connect(dryGain);
            dryGain.connect(outputNode);
            wetGain.connect(outputNode);
            lfoNode.connect(lfoDepthGain);
            lfoDepthGain.connect(filterNode.frequency);
            lfoNode.start(0);
            const update = (newParams) => {
                filterNode.type = newParams.type;
                filterNode.Q.setTargetAtTime(newParams.q, audioContext.currentTime, 0.01);
                filterNode.frequency.setTargetAtTime(newParams.frequency, audioContext.currentTime, 0.01);
                lfoNode.frequency.setTargetAtTime(newParams.lfo_rate, audioContext.currentTime, 0.01);
                lfoDepthGain.gain.setTargetAtTime(newParams.lfo_depth, audioContext.currentTime, 0.01);
                wetGain.gain.setTargetAtTime(newParams.mix, audioContext.currentTime, 0.01);
                dryGain.gain.setTargetAtTime(1.0 - newParams.mix, audioContext.currentTime, 0.01);
            };
            update(effectInstance.parameters);
            return { input: inputNode, output: outputNode, nodes: [inputNode, outputNode, dryGain, wetGain, filterNode, lfoNode, lfoDepthGain], update: update };
        }
        
        case 'delay': {
            const inputNode = audioContext.createGain();
            const outputNode = audioContext.createGain();
            const dryGain = audioContext.createGain();
            const wetGain = audioContext.createGain();
            const delayNode = audioContext.createDelay(5.0); 
            const feedbackNode = audioContext.createGain();
            inputNode.connect(dryGain);
            dryGain.connect(outputNode);
            inputNode.connect(wetGain);
            wetGain.connect(delayNode);
            delayNode.connect(feedbackNode);
            feedbackNode.connect(delayNode);
            delayNode.connect(outputNode);
            const update = (newParams) => {
                delayNode.delayTime.setTargetAtTime(newParams.time, audioContext.currentTime, 0.01);
                feedbackNode.gain.setTargetAtTime(newParams.feedback, audioContext.currentTime, 0.01);
                wetGain.gain.setTargetAtTime(newParams.mix, audioContext.currentTime, 0.01);
                dryGain.gain.setTargetAtTime(1.0 - newParams.mix, audioContext.currentTime, 0.01);
            };
            update(effectInstance.parameters);
            return { input: inputNode, output: outputNode, nodes: [inputNode, outputNode, dryGain, wetGain, delayNode, feedbackNode], update: update };
        }

        case 'saturation': {
            const inputNode = audioContext.createGain();
            const driveNode = audioContext.createGain();
            const waveShaperNode = audioContext.createWaveShaper();
            const toneNode = audioContext.createBiquadFilter();
            const outputNode = audioContext.createGain();
            const dryGain = audioContext.createGain();
            const wetGain = audioContext.createGain();
            inputNode.connect(driveNode);
            inputNode.connect(dryGain);
            dryGain.connect(outputNode);
            driveNode.connect(waveShaperNode);
            waveShaperNode.connect(toneNode);
            toneNode.connect(wetGain);
            wetGain.connect(outputNode);
            toneNode.type = 'lowpass';
            const makeDistortionCurve = (amount) => {
                const k = typeof amount === 'number' ? amount : 50;
                const n_samples = 44100;
                const curve = new Float32Array(n_samples);
                const deg = Math.PI / 180;
                for (let i = 0; i < n_samples; ++i) {
                    const x = i * 2 / n_samples - 1;
                    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
                }
                return curve;
            };
            const update = (newParams) => {
                driveNode.gain.setTargetAtTime(newParams.drive / 10, audioContext.currentTime, 0.01);
                waveShaperNode.curve = makeDistortionCurve(newParams.drive);
                toneNode.frequency.setTargetAtTime(newParams.tone, audioContext.currentTime, 0.01);
                wetGain.gain.setTargetAtTime(newParams.mix, audioContext.currentTime, 0.01);
                dryGain.gain.setTargetAtTime(1.0 - newParams.mix, audioContext.currentTime, 0.01);
            };
            update(effectInstance.parameters);
            return { input: inputNode, output: outputNode, nodes: [inputNode, outputNode, driveNode, waveShaperNode, toneNode, dryGain, wetGain], update: update };
        }

        case 'chorus': {
            const inputNode = audioContext.createGain();
            const outputNode = audioContext.createGain();
            const dryGain = audioContext.createGain();
            const wetGain = audioContext.createGain();
            const delayNode = audioContext.createDelay(0.1);
            const lfoNode = audioContext.createOscillator();
            const lfoDepthGain = audioContext.createGain();
            inputNode.connect(dryGain);
            dryGain.connect(outputNode);
            inputNode.connect(delayNode);
            delayNode.connect(wetGain);
            wetGain.connect(outputNode);
            lfoNode.connect(lfoDepthGain);
            lfoDepthGain.connect(delayNode.delayTime);
            lfoNode.start(0);
            const update = (newParams) => {
                lfoNode.frequency.setTargetAtTime(newParams.rate, audioContext.currentTime, 0.01);
                lfoDepthGain.gain.setTargetAtTime(newParams.depth * 0.01, audioContext.currentTime, 0.01);
                delayNode.delayTime.setTargetAtTime(newParams.delay, audioContext.currentTime, 0.01);
                wetGain.gain.setTargetAtTime(newParams.mix, audioContext.currentTime, 0.01);
                dryGain.gain.setTargetAtTime(1.0 - newParams.mix, audioContext.currentTime, 0.01);
            };
            update(effectInstance.parameters);
            return { input: inputNode, output: outputNode, nodes: [inputNode, outputNode, dryGain, wetGain, delayNode, lfoNode, lfoDepthGain], update: update };
        }
        
        case 'compressor': {
            const compressorNode = audioContext.createDynamicsCompressor();
            const update = (newParams) => {
                compressorNode.threshold.setTargetAtTime(newParams.threshold, audioContext.currentTime, 0.01);
                compressorNode.knee.setTargetAtTime(newParams.knee, audioContext.currentTime, 0.01);
                compressorNode.ratio.setTargetAtTime(newParams.ratio, audioContext.currentTime, 0.01);
                compressorNode.attack.setTargetAtTime(newParams.attack, audioContext.currentTime, 0.01);
                compressorNode.release.setTargetAtTime(newParams.release, audioContext.currentTime, 0.01);
            };
            update(effectInstance.parameters);
            return { input: compressorNode, output: compressorNode, nodes: [compressorNode], update: update };
        }
        
        case 'black_hole_voice': {
            const inputNode = audioContext.createGain();
            const outputNode = audioContext.createGain();
            const dryGain = audioContext.createGain();
            const wetGain = audioContext.createGain();

            const resonanceFilter = audioContext.createBiquadFilter();
            resonanceFilter.type = 'peaking';
            
            const distortionNode = audioContext.createWaveShaper();

            inputNode.connect(dryGain);
            dryGain.connect(outputNode);

            inputNode.connect(resonanceFilter);
            resonanceFilter.connect(distortionNode);
            distortionNode.connect(wetGain);
            wetGain.connect(outputNode);

            const makeDistortionCurve = (amount) => {
                if (amount === 0) return;
                const k = typeof amount === 'number' ? amount : 50;
                const n_samples = 44100;
                const curve = new Float32Array(n_samples);
                const deg = Math.PI / 180;
                for (let i = 0; i < n_samples; ++i) {
                    const x = i * 2 / n_samples - 1;
                    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
                }
                return curve;
            };

            const update = (newParams) => {
                resonanceFilter.frequency.setTargetAtTime(newParams.frequency, audioContext.currentTime, 0.01);
                resonanceFilter.Q.setTargetAtTime(newParams.q, audioContext.currentTime, 0.01);
                resonanceFilter.gain.setTargetAtTime(newParams.gain, audioContext.currentTime, 0.01);
                
                distortionNode.curve = makeDistortionCurve(newParams.gravity);
                distortionNode.oversample = '4x';

                wetGain.gain.setTargetAtTime(newParams.mix, audioContext.currentTime, 0.02);
                dryGain.gain.setTargetAtTime(1.0 - newParams.mix, audioContext.currentTime, 0.02);
            };

            update(effectInstance.parameters);

            return {
                input: inputNode,
                output: outputNode,
                nodes: [inputNode, outputNode, dryGain, wetGain, resonanceFilter, distortionNode],
                update: update,
            };
        }

        case 'planetary_phaser': {
            const STAGES = 6;
            const inputNode = audioContext.createGain();
            const outputNode = audioContext.createGain();
            const dryGain = audioContext.createGain();
            const wetGain = audioContext.createGain();
            const feedbackGain = audioContext.createGain();

            inputNode.connect(dryGain);
            dryGain.connect(outputNode);
            
            inputNode.connect(wetGain);

            const filters = [];
            for (let i = 0; i < STAGES; i++) {
                const filter = audioContext.createBiquadFilter();
                filter.type = 'allpass';
                filters.push(filter);
                if (i > 0) {
                    filters[i - 1].connect(filters[i]);
                }
            }
            wetGain.connect(filters[0]);
            filters[STAGES - 1].connect(outputNode);
            filters[STAGES - 1].connect(feedbackGain);
            feedbackGain.connect(filters[0]);
            
            const lfo = audioContext.createOscillator();
            const lfoDepth = audioContext.createGain();
            lfo.type = 'sine';
            lfo.connect(lfoDepth);
            filters.forEach(filter => {
                lfoDepth.connect(filter.frequency);
            });
            lfo.start(0);

            const update = (newParams) => {
                dryGain.gain.setTargetAtTime(1.0 - newParams.mix, audioContext.currentTime, 0.02);
                wetGain.gain.setTargetAtTime(newParams.mix, audioContext.currentTime, 0.02);
                lfo.frequency.setTargetAtTime(newParams.rate, audioContext.currentTime, 0.02);
                lfoDepth.gain.setTargetAtTime(newParams.depth * newParams.baseFrequency * 0.5, audioContext.currentTime, 0.02);
                filters.forEach(filter => {
                    filter.frequency.setTargetAtTime(newParams.baseFrequency, audioContext.currentTime, 0.02);
                });
                feedbackGain.gain.setTargetAtTime(newParams.feedback, audioContext.currentTime, 0.02);
            };

            update(effectInstance.parameters);

            return {
                input: inputNode,
                output: outputNode,
                nodes: [inputNode, outputNode, dryGain, wetGain, feedbackGain, lfo, lfoDepth, ...filters],
                update: update,
            };
        }

        case 'reverb': {
            const inputGain = audioContext.createGain();
            const dryGain = audioContext.createGain();
            const wetGain = audioContext.createGain();
            const preDelayNode = audioContext.createDelay(1.0);
            const convolverNode = audioContext.createConvolver();
            const outputGain = audioContext.createGain();
            inputGain.connect(dryGain);
            dryGain.connect(outputGain);
            inputGain.connect(preDelayNode);
            preDelayNode.connect(convolverNode);
            convolverNode.connect(wetGain);
            wetGain.connect(outputGain);
            
            const initialDecay = effectInstance.parameters.decay;
            if (initialDecay) {
                convolverNode.buffer = generateImpulseResponse(audioContext, initialDecay, 2);
            }

            const update = (newParams) => {
                dryGain.gain.setTargetAtTime(1.0 - newParams.mix, audioContext.currentTime, 0.01);
                wetGain.gain.setTargetAtTime(newParams.mix, audioContext.currentTime, 0.01);
                preDelayNode.delayTime.setTargetAtTime(newParams.preDelay / 1000, audioContext.currentTime, 0.01);
                if (newParams.decay && (convolverNode.buffer === null || convolverNode.buffer.duration.toFixed(1) !== newParams.decay.toFixed(1))) {
                        convolverNode.buffer = generateImpulseResponse(audioContext, newParams.decay, 2);
                }
            };
            update(effectInstance.parameters);
            return { input: inputGain, output: outputGain, nodes: [inputGain, dryGain, wetGain, preDelayNode, convolverNode, outputGain], update: update };
        }

        default:
            console.warn(`Efeito desconhecido: ${effectId}`);
            return null;
    }
}