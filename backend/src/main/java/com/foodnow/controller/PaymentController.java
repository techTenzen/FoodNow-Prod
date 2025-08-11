package com.foodnow.controller;

import com.foodnow.dto.PaymentDto;
import com.foodnow.model.Payment;
import com.foodnow.service.PaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@PreAuthorize("hasRole('CUSTOMER')")
public class PaymentController {

    @Autowired
    private PaymentService paymentService;

    @PostMapping("/process")
    public ResponseEntity<?> processPayment(@RequestBody Map<String, Integer> payload) {
        try {
            int orderId = payload.get("orderId");
            Payment payment = paymentService.processPaymentForOrder(orderId);
            return ResponseEntity.ok(toPaymentDto(payment));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private PaymentDto toPaymentDto(Payment payment) {
        PaymentDto dto = new PaymentDto();
        dto.setId(payment.getId());
        dto.setOrderId(payment.getOrder().getId());
        dto.setAmount(payment.getAmount());
        dto.setStatus(payment.getStatus());
        dto.setTransactionId(payment.getTransactionId());
        dto.setPaymentTime(payment.getPaymentTime());
        return dto;
    }
}
