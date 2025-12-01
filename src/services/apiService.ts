import { AppConfig, SrAlert } from '../types';

/**
 * Fetches alerts from the Sveriges Radio VMA API.
 */
export const fetchSrAlerts = async (config: AppConfig): Promise<SrAlert[]> => {
  const targetUrl = config.srApiUrl;
  const url = config.corsProxy 
    ? `${config.corsProxy}${targetUrl}`
    : targetUrl;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SR API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // The SR API structure usually has a root object. Adjusting based on standard CAP/VMA formats.
    // Assuming the API returns { alerts: [...] } or just [...]
    return data.alerts || data || [];
  } catch (error) {
    console.error("Failed to fetch SR Alerts", error);
    throw error;
  }
};

// --- Minimal Protobuf / Binary Helper for Meshtastic ---
// Meshtastic expects: [0x94, 0xC3] + [PacketLength (2 bytes)] + [ProtobufBytes]

class ProtoBuilder {
  private buffer: number[] = [];

  // Write a Varint (used for tags and lengths in protobuf)
  addVarint(value: number) {
    // Ensure we are working with a positive integer for the loop
    value = value >>> 0;
    while (value > 127) {
      this.buffer.push((value & 0x7F) | 0x80);
      value >>>= 7;
    }
    this.buffer.push(value);
  }

  // Write a Tag (Field ID + Wire Type)
  addTag(fieldId: number, wireType: number) {
    this.addVarint((fieldId << 3) | wireType);
  }

  // Write String/Bytes field
  addString(fieldId: number, text: string) {
    this.addTag(fieldId, 2); // WireType 2 = Length Delimited
    const encoded = new TextEncoder().encode(text);
    this.addVarint(encoded.length);
    encoded.forEach(b => this.buffer.push(b));
  }

  // Write boolean (as varint 0 or 1)
  addBool(fieldId: number, value: boolean) {
    this.addTag(fieldId, 0); // WireType 0 = Varint
    this.addVarint(value ? 1 : 0);
  }

  // Write Enum/UInt32 (Varint)
  addUInt32(fieldId: number, value: number) {
    this.addTag(fieldId, 0);
    this.addVarint(value);
  }

  // Write Fixed32 (4 bytes little endian)
  addFixed32(fieldId: number, value: number) {
    this.addTag(fieldId, 5); // WireType 5 = 32-bit
    // Use unsigned right shift (>>>) to handle 32-bit uints correctly in JS
    this.buffer.push((value >>> 0) & 0xFF);
    this.buffer.push((value >>> 8) & 0xFF);
    this.buffer.push((value >>> 16) & 0xFF);
    this.buffer.push((value >>> 24) & 0xFF);
  }

  // Embed another ProtoBuilder's content as a nested message
  addNested(fieldId: number, nested: ProtoBuilder) {
    this.addTag(fieldId, 2);
    const bytes = nested.getBytes();
    this.addVarint(bytes.length);
    bytes.forEach(b => this.buffer.push(b));
  }

  getBytes() {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Serial Handler for Web Serial API
 */
export class SerialHandler {
  private port: any | null = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private isConnected: boolean = false;
  private statusListeners: ((connected: boolean) => void)[] = [];

  constructor() {
    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      // Listen for global connect/disconnect events (physically plugging/unplugging)
      // @ts-ignore
      navigator.serial.addEventListener('disconnect', (event) => {
        if (event.target === this.port) {
           this.cleanupAndNotify();
        }
      });
    } else {
      console.warn("Web Serial API not supported in this browser.");
    }
  }

  // Allow UI to subscribe to connection changes
  onStatusChange(callback: (connected: boolean) => void) {
    this.statusListeners.push(callback);
    // Immediately fire current status
    callback(this.isConnected);
  }

  private setConnected(status: boolean) {
    this.isConnected = status;
    this.statusListeners.forEach(cb => cb(status));
  }

  private async cleanupAndNotify() {
    if (this.writer) {
      try {
        await this.writer.releaseLock();
      } catch (e) { console.warn("Lock release error", e); }
      this.writer = null;
    }
    if (this.port) {
      try {
        await this.port.close();
      } catch (e) { console.warn("Port close error", e); }
      this.port = null;
    }
    this.setConnected(false);
  }

  async connect(): Promise<boolean> {
    if (!('serial' in navigator)) {
      throw new Error("Web Serial API not supported. Please use Chrome, Edge, or Opera.");
    }

    try {
      // Requesting a port without filters ensures the browser shows ALL available serial devices.
      // This is crucial for generic ESP32 boards or devices with less common Vendor IDs.
      // @ts-ignore
      const port = await navigator.serial.requestPort({});
      this.port = port;
      
      await this.port.open({ baudRate: 115200 });
      this.setConnected(true);
      
      return true;
    } catch (error: any) {
      console.error("Error connecting to serial port:", error);
      this.setConnected(false);
      
      if (error.name === 'NotFoundError') {
        throw new Error("No device selected. Please select your Meshtastic device from the list.");
      }
      if (error.name === 'SecurityError') {
        throw new Error("Security Error: To use Web Serial, this page must be served over HTTPS or localhost.");
      }
      if (error.name === 'NetworkError') {
        throw new Error("Network Error: The device may be disconnected or in use by another application.");
      }
      throw error;
    }
  }

  /**
   * Attempts to connect to a previously granted port without a user prompt.
   */
  async connectToExisting(): Promise<boolean> {
    if (!('serial' in navigator)) return false;

    try {
      // @ts-ignore
      const ports = await navigator.serial.getPorts();
      if (ports && ports.length > 0) {
        // Just take the first available port that we have permission for
        this.port = ports[0];
        
        // Check if already open
        if (this.port.readable || this.port.writable) {
           this.setConnected(true);
           return true;
        }
        
        // Attempt to open
        await this.port.open({ baudRate: 115200 });
        this.setConnected(true);
        return true;
      }
    } catch (error) {
      console.warn("Could not auto-connect to existing port:", error);
      // Don't throw here, just return false so the UI knows to ask user
    }
    return false;
  }

  async disconnect() {
    await this.cleanupAndNotify();
  }

  getConnectedStatus() {
    return this.isConnected;
  }

  /**
   * Constructs a binary Meshtastic packet and sends it via Serial.
   */
  async sendText(text: string, channelIndex: number = 0) {
    if (!this.port || !this.isConnected) {
      throw new Error("Serial port not connected");
    }

    if (!this.port.writable) {
         throw new Error("Serial port not writable");
    }

    // --- 1. Construct the 'Data' payload (the text message) ---
    const dataPb = new ProtoBuilder();
    dataPb.addUInt32(1, 1); // portnum = 1 (TEXT_MESSAGE_APP)
    dataPb.addString(2, text); // payload = "text"
    
    // --- 2. Construct the 'MeshPacket' ---
    const meshPacketPb = new ProtoBuilder();
    meshPacketPb.addFixed32(1, 0); // from = 1 (Sender 0 = local)
    meshPacketPb.addFixed32(2, 0xFFFFFFFF); // to = 2 (Broadcast -1)
    meshPacketPb.addUInt32(3, channelIndex); // channel = 3 (Index)
    meshPacketPb.addNested(4, dataPb); // decoded = 4 (Data)
    
    // Packet ID (Field 6)
    const packetId = Math.floor(Math.random() * 0xFFFFFFFF);
    meshPacketPb.addFixed32(6, packetId);

    // Hop Limit (Field 10) - Standard is 3
    meshPacketPb.addUInt32(10, 3);
    
    // Want Ack (Field 11) - Optional, set true for reliability
    meshPacketPb.addBool(11, true);

    // --- 3. Construct the 'ToRadio' packet wrapper ---
    const toRadioPb = new ProtoBuilder();
    toRadioPb.addNested(1, meshPacketPb); // packet = 1 (MeshPacket)

    // Get the protobuf bytes
    const protoBytes = toRadioPb.getBytes();

    // --- 4. Construct the Final Serial Frame ---
    // Header: 0x94 0xC3
    // Length: 2 bytes (Big Endian)
    const header = new Uint8Array([0x94, 0xC3, (protoBytes.length >>> 8) & 0xFF, protoBytes.length & 0xFF]);

    const writer = this.port.writable.getWriter();
    
    try {
      // Create a combined buffer for sending
      const combined = new Uint8Array(header.length + protoBytes.length);
      combined.set(header);
      combined.set(protoBytes, header.length);

      // Log hex for debugging
      const hex = Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`[Serial] Sending ${combined.length} bytes: ${hex}`);

      await writer.write(combined);
    } finally {
      writer.releaseLock();
    }
    
    return "Message sent to Serial (Binary)";
  }
}

// Singleton instance for the app to share
export const serialHandler = new SerialHandler();

/**
 * Sends a text message to a Meshtastic device via HTTP API or Serial.
 */
export const sendToMeshtastic = async (
  config: AppConfig,
  text: string
): Promise<any> => {
  
  // Handle Serial Mode
  if (config.connectionMode === 'serial') {
    if (!serialHandler.getConnectedStatus()) {
      throw new Error("Device not connected. Click 'Connect USB' in the header.");
    }
    
    // STRICT BYTE LIMIT: Meshtastic packet max is ~237 bytes, but headers reduce this.
    // Swedish chars (åäö) are 2 bytes each. simple .substring() is unsafe.
    // 190 bytes is a safe limit to ensure reliable delivery.
    const MAX_BYTES = 190;
    
    let safeText = text;
    const encoder = new TextEncoder();
    
    // Reduce length until byte size is small enough
    while (encoder.encode(safeText).length > MAX_BYTES) {
        safeText = safeText.slice(0, -1);
    }
    
    // If we truncated, try to add ellipsis cleanly
    if (safeText.length < text.length) {
       const ellipsis = "...";
       // Make room for ellipsis
       while (encoder.encode(safeText + ellipsis).length > MAX_BYTES) {
          safeText = safeText.slice(0, -1);
       }
       safeText += ellipsis;
    }

    return await serialHandler.sendText(safeText, config.meshtasticChannelIndex);
  }

  // Handle HTTP Mode
  let host = config.meshtasticIp;
  if (!host.startsWith('http')) {
    host = `http://${host}`;
  }

  host = host.replace(/\/$/, '');
  const url = `${host}/api/v1/toRadio`;
  
  const payload = {
    to: 4294967295, // Broadcast to all
    decoded: {
      text: text,
      portnum: 1 
    },
    channel: config.meshtasticChannelIndex, // Specify the channel index (0-7)
    want_ack: true
  };

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Meshtastic API Error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error("Failed to send to Meshtastic", error);
    throw error;
  }
};