package com.agrocenter.compras.client.dto;

public record InventoryStockRequest(
        Long productoId,
        Integer cantidad,
        String referencia
) {
}
