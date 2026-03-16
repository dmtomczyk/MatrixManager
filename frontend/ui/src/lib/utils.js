export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export function readBootPayload() {
  const root = document.getElementById('root');
  const script = document.getElementById('mm-react-props');
  let props = {};
  if (script?.textContent) {
    try {
      props = JSON.parse(script.textContent);
    } catch {
      props = {};
    }
  }
  return {
    page: root?.dataset.page || 'home',
    props,
  };
}
