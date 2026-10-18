package com.agrocenter.compras.service;

import java.math.BigDecimal;

record DetallePreparado(
        Long productoId,
        Integer cantidad,
        BigDecimal precioUnitario,
        BigDecimal subtotal
) {
}
