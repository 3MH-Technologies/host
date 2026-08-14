'use client'
import { io, Socket } from 'socket.io-client'

let processSocket: Socket | null = null
let terminalSocket: Socket | null = null

export function getProcessSocket(): Socket {
  if (!processSocket || !processSocket.connected) {
    processSocket = io('/?XTransformPort=3003', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })
  }
  return processSocket
}

export function getTerminalSocket(): Socket {
  if (!terminalSocket || !terminalSocket.connected) {
    terminalSocket = io('/?XTransformPort=3004', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
    })
  }
  return terminalSocket
}

export function disconnectAll() {
  processSocket?.disconnect()
  terminalSocket?.disconnect()
  processSocket = null
  terminalSocket = null
}
