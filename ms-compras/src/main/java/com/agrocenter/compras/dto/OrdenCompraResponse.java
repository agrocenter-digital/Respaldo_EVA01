package com.agrocenter.compras.dto;

import com.agrocenter.compras.entity.EstadoOrden;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record OrdenCompraResponse(
        Long id,
        Long proveedorId,
        LocalDateTime fechaCreacion,
        EstadoOrden estado,
        BigDecimal total,
        List<DetalleOrdenCompraResponse> detalles
) {
}
