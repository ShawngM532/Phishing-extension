/** Styles injected into the closed shadow root. Inline only, no external assets. */
export const UI_STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }

.banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; min-height: 48px;
  background: #b45309; color: #ffffff; font-size: 14px; line-height: 1.35;
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
}
.banner__text { flex: 1; }
.banner__text strong { font-weight: 700; }
.banner__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.chip { background: rgba(0,0,0,0.22); border-radius: 10px; padding: 2px 8px; font-size: 12px; }
.banner__actions { display: flex; gap: 8px; flex-shrink: 0; }

.btn {
  font-size: 13px; padding: 6px 12px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent; font-weight: 600;
}
.btn--primary { background: #ffffff; color: #7c2d12; }
.btn--secondary { background: transparent; color: #ffffff; border-color: rgba(255,255,255,0.7); }
.btn--danger { background: #dc2626; color: #ffffff; }

.overlay {
  position: fixed; inset: 0; z-index: 2147483647;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.82); padding: 24px;
}
.card {
  background: #ffffff; color: #111827; border-radius: 12px; max-width: 460px; width: 100%;
  padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}
.card__headline { margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #b91c1c; }
.card__body { margin: 0 0 12px; font-size: 14px; line-height: 1.5; }
.card__reasons { margin: 0 0 16px; padding-left: 18px; font-size: 13px; line-height: 1.5; }
.card__actions { display: flex; align-items: center; gap: 12px; }
.card__link { background: none; border: none; color: #6b7280; text-decoration: underline; cursor: pointer; font-size: 13px; }
`;
