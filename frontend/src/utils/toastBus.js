class ToastBus {
  constructor() {
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(type, message, options = {}) {
    this.listeners.forEach((listener) => {
      try {
        listener({ type, message, ...options });
      } catch (err) {
        console.error('ToastBus listener error:', err);
      }
    });
  }
}

export const toastBus = new ToastBus();
export default toastBus;

