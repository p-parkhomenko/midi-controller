export default class MIDITransport {
  constructor() {
    this._access = null;
    this._output = null;
    this._portsCallback = null;
    this._activityCallbacks = [];
  }

  async connect() {
    if (!navigator.requestMIDIAccess) throw new Error('No Web MIDI');
    this._access = await navigator.requestMIDIAccess({ sysex: false });
    this._access.onstatechange = () => {
      if (this._portsCallback) this._portsCallback(this.getPorts());
    };
    return this.getPorts();
  }

  selectPort(id) {
    this._output = this._access?.outputs.get(id) ?? null;
    return !!this._output;
  }

  getPorts() {
    if (!this._access) return [];
    return Array.from(this._access.outputs.values())
      .map(p => ({ id: p.id, name: p.name }));
  }

  onPortsChange(cb) { this._portsCallback = cb; }
  onActivity(cb)    { this._activityCallbacks.push(cb); }
  get isConnected() { return !!this._output; }

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
}
