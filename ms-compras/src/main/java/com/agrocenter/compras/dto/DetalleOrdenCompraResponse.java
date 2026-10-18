package com.agrocenter.compras.dto;

import java.math.BigDecimal;

public record DetalleOrdenCompraResponse(
        Long id,
        Long productoId,
        Integer cantidad,
        BigDecimal precioUnitario,
        BigDecimal subtotal
) {
}
