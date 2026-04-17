let _nextCC   = 70;
let _nextNote = 36;

const nextCC   = () => _nextCC++;
const nextNote = () => _nextNote++;
const uuid     = () => Math.random().toString(36).slice(2);

export function createFader(label = '') {
  return { id: uuid(), type: 'fader', cc: nextCC(), channel: 1, value: 0, label };
}

export function createButton(mode, label = '') {
  return { id: uuid(), type: 'button', mode, note: nextNote(), channel: 1, state: false, label };
}

export function createChannelStrip(label) {
  return {
    id: uuid(), label,
    fader:   createFader('vol'),
    mute:    createButton('toggle',    'mute'),
    killLow: createButton('toggle',    'lo'),
    killMid: createButton('toggle',    'mid'),
    killHi:  createButton('toggle',    'hi'),
    impulse: createButton('momentary', 'fx'),
  };
}

export const layout = { strips: [createChannelStrip('CH 1')] };
