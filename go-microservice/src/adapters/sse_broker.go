package adapters

import (
	"context"
	"sync"

	"localstream/go-microservice/src/domain"
)

// SSEBroker gestiona las suscripciones de clientes SSE y difunde eventos de progreso sin polling en reposo (SDD 6.2).
type SSEBroker struct {
	mu      sync.RWMutex
	clients map[chan domain.ProgressEvent]struct{}
}

// NewSSEBroker crea una nueva instancia de SSEBroker.
func NewSSEBroker() *SSEBroker {
	return &SSEBroker{
		clients: make(map[chan domain.ProgressEvent]struct{}),
	}
}

// Publish envía un evento de progreso a todos los suscriptores conectados de forma no bloqueante.
func (b *SSEBroker) Publish(event domain.ProgressEvent) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for ch := range b.clients {
		select {
		case ch <- event:
		default:
			// Si el buffer del cliente está lleno, descartar el evento más antiguo para priorizar el estado más reciente
			select {
			case <-ch:
			default:
			}
			select {
			case ch <- event:
			default:
			}
		}
	}
}

// Subscribe registra un nuevo cliente SSE y devuelve su canal de lectura junto con su función de limpieza.
func (b *SSEBroker) Subscribe(ctx context.Context) (<-chan domain.ProgressEvent, func()) {
	ch := make(chan domain.ProgressEvent, 32)

	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()

	var once sync.Once
	unsubscribe := func() {
		once.Do(func() {
			b.mu.Lock()
			if _, exists := b.clients[ch]; exists {
				delete(b.clients, ch)
				close(ch)
			}
			b.mu.Unlock()
		})
	}

	go func() {
		<-ctx.Done()
		unsubscribe()
	}()

	return ch, unsubscribe
}

// ClientCount devuelve el número actual de clientes SSE conectados.
func (b *SSEBroker) ClientCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.clients)
}
