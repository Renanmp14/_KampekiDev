import React from 'react';

export default function Modal({ title, children, onClose, footer }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}
