// The small pop-over menus (timer presets, settings). One open at a time; a tap elsewhere or Escape closes them.
const menus = [];
export function registerMenu(button, panel, onOpen) {
  menus.push({ button, panel });
  button.addEventListener('click', () => {
    const open = panel.hidden; closeMenus();
    panel.hidden = !open; button.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden && onOpen) onOpen();
  });
}
export function closeMenus() { for (const m of menus) { m.panel.hidden = true; m.button.setAttribute('aria-expanded', 'false'); } }
document.addEventListener('pointerdown', e => { if (!e.target.closest('.timer, .settings')) closeMenus(); });
