// How awake the music-reacting scenes are: 1 while music plays, easing to 0 when it stops (set by main.js each frame).
// Their made-up signals (the fake beat, spectrum and waveform they show when the music is quiet) are scaled by it, so
// with nothing playing the lines lie flat and the bars sink, and main.js stops their clocks.
export let restK = 1;
export const setRestK = v => { restK = v; };
