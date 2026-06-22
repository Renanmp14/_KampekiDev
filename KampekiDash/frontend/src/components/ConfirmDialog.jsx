import React from 'react';
import Modal from './Modal.jsx';

export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Excluir' }) {
  return (
    <Modal
      title="Confirmar"
      onClose={onCancel}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </>
      )}
    >
      <p>{message}</p>
    </Modal>
  );
}
