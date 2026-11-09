/**
 * 让鼠标中键和左键触发同一套点击。
 * 浏览器里中键只会自动滚动，不会派发 button 为 0 的 click。
 */

let middleClickHandled = false;

const submitTypes = new Set(['submit', 'image']);

const isSubmitControl = (element) => {
  if (element instanceof HTMLButtonElement) {
    return !element.disabled && element.type === 'submit';
  }
  if (element instanceof HTMLInputElement) {
    return !element.disabled && submitTypes.has(element.type);
  }
  return false;
};

const editableField = (element) => {
  const field = element.closest('input, textarea, [contenteditable="true"]');
  if (!(field instanceof HTMLElement) || field.disabled) return null;
  if (field instanceof HTMLInputElement) {
    if (field.readOnly || field.type === 'hidden' || field.type === 'button' || field.type === 'submit' || field.type === 'reset' || field.type === 'checkbox' || field.type === 'radio' || field.type === 'file' || field.type === 'range' || field.type === 'color' || field.type === 'image') {
      return null;
    }
    return field;
  }
  if (field instanceof HTMLTextAreaElement) {
    return field.readOnly ? null : field;
  }
  return field.isContentEditable ? field : null;
};

const placeEditableCaret = (field, event) => {
  const place = field.ownerDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (!place) return;
  const selection = field.ownerDocument.getSelection?.();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(place);
};

const leftClickInit = (event) => ({
  bubbles: true,
  cancelable: true,
  composed: true,
  view: window,
  detail: event.detail || 1,
  screenX: event.screenX,
  screenY: event.screenY,
  clientX: event.clientX,
  clientY: event.clientY,
  ctrlKey: event.ctrlKey,
  altKey: event.altKey,
  shiftKey: event.shiftKey,
  metaKey: event.metaKey,
  button: 0,
  buttons: 0,
});

/** 在中键松开的位置补一次左键点击，并补上表单提交这类默认动作。 */
const activateLikeLeftClick = (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const field = editableField(target);
  if (field) {
    field.focus();
    placeEditableCaret(field, event);
  }

  const control = target.closest('button, input');
  const form = isSubmitControl(control) ? control.form : null;
  let submitted = false;
  const markSubmitted = () => {
    submitted = true;
  };
  form?.addEventListener('submit', markSubmitted, true);

  const clickEvent = new MouseEvent('click', leftClickInit(event));
  const proceeded = target.dispatchEvent(clickEvent);
  form?.removeEventListener('submit', markSubmitted, true);
  // 有的浏览器会让这次 click 直接提交，没提交时再补一次
  if (proceeded && form && !submitted) form.requestSubmit(control);
};

/** 绑定中键等价左键。返回解绑函数。 */
export function bindMiddleClickAsLeftClick() {
  const blockAutoScroll = (event) => {
    if (event.button === 1) event.preventDefault();
  };

  const onAuxClick = (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    middleClickHandled = true;
    activateLikeLeftClick(event);
    queueMicrotask(() => {
      middleClickHandled = false;
    });
  };

  // 部分浏览器中键还会再派发一次 click，吞掉以免点两次
  const onMiddleClick = (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    if (!middleClickHandled) activateLikeLeftClick(event);
  };

  document.addEventListener('mousedown', blockAutoScroll, true);
  document.addEventListener('auxclick', onAuxClick, true);
  document.addEventListener('click', onMiddleClick, true);

  return () => {
    document.removeEventListener('mousedown', blockAutoScroll, true);
    document.removeEventListener('auxclick', onAuxClick, true);
    document.removeEventListener('click', onMiddleClick, true);
  };
}
