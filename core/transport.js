export default class MIDITransport {
  constructor() {
    this._access = null;
    this._output = null;
    this._input  = null;
    this._outputPortsCallback = null;
    this._inputPortsCallback  = null;
    this._activityCallbacks = [];
    this._messageCallbacks  = [];
  }

  async connect() {
    if (!navigator.requestMIDIAccess) throw new Error('No Web MIDI');
    this._access = await navigator.requestMIDIAccess({ sysex: false });
    this._access.onstatechange = () => {
      if (this._outputPortsCallback) this._outputPortsCallback(this.getOutputPorts());
      if (this._inputPortsCallback)  this._inputPortsCallback(this.getInputPorts());
    };
    return {
      outputs: this.getOutputPorts(),
      inputs:  this.getInputPorts(),
    };
  }

  getOutputPorts() {
    if (!this._access) return [];
    return Array.from(this._access.outputs.values()).map(p => ({ id: p.id, name: p.name }));
  }

  getInputPorts() {
    if (!this._access) return [];
    return Array.from(this._access.inputs.values()).map(p => ({ id: p.id, name: p.name }));
  }

  selectOutputPort(id) {
    this._output = this._access?.outputs.get(id) ?? null;
    return !!this._output;
  }

  selectInputPort(id) {
    if (this._input) this._input.onmidimessage = null;
    this._input = this._access?.inputs.get(id) ?? null;
    if (this._input) this._input.onmidimessage = (e) => this._handleInput(e.data);
    return !!this._input;
  }

  onOutputPortsChange(cb) { this._outputPortsCallback = cb; }
  onInputPortsChange(cb)  { this._inputPortsCallback  = cb; }
  onActivity(cb)          { this._activityCallbacks.push(cb); }
  onMessage(cb)           { this._messageCallbacks.push(cb); }

  get isConnected() { return !!this._output; }
  get isListening() { return !!this._input; }

  send(msg) {
    if (!this._output) return;
    const bytes = this._encode(msg);
    if (bytes) {
      this._output.send(bytes);
      this._activityCallbacks.forEach(cb => cb(msg));
    }
  }

  _encode(msg) {
    const ch = ((msg.channel ?? 1) - 1) & 0xF;
    switch (msg.type) {
      case 'cc':       return [0xB0 | ch, msg.cc & 0x7F, msg.value & 0x7F];
      case 'note_on':  return [0x90 | ch, msg.note & 0x7F, (msg.velocity ?? 100) & 0x7F];
      case 'note_off': return [0x80 | ch, msg.note & 0x7F, 0];
      default: return null;
    }
  }

  _handleInput(bytes) {
    const msg = this._decode(bytes);
    if (msg) this._messageCallbacks.forEach(cb => cb(msg));
  }

  _decode(bytes) {
    const status  = bytes[0] & 0xF0;
    const channel = (bytes[0] & 0x0F) + 1;
    if (status === 0xB0) return { type: 'cc', channel, cc: bytes[1], value: bytes[2] };
    if (status === 0x90) {
      if (bytes[2] === 0) return { type: 'note_off', channel, note: bytes[1], velocity: 0 };
      return { type: 'note_on', channel, note: bytes[1], velocity: bytes[2] };
    }
    if (status === 0x80) return { type: 'note_off', channel, note: bytes[1], velocity: bytes[2] };
    return null;
  }
}
