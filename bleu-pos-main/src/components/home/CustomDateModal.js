import React, { useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import "./CustomDateModal.css";

function CustomDateModal({ show, onClose, onApply }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const handleApply = () => {
    if (start && end) {
      onApply(start, end);
      onClose();
    }
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      dialogClassName="custom-date-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>Select Custom Date Range</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Start Date</Form.Label>
            <Form.Control
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-0">
            <Form.Label>End Date</Form.Label>
            <Form.Control
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Form.Group>
        </Form>
      </Modal.Body>

      {/* Footer must be Modal.Footer (Bootstrap) */}
      <Modal.Footer className="custom-modal-footer">
        <Button variant="primary" onClick={handleApply} className="apply-btn">
          Apply
        </Button>
        <Button variant="secondary" onClick={onClose} className="cancel-btn">
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default CustomDateModal;
