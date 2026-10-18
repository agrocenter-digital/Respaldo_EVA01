package com.agrocenter.ms_inventario.dto;

public record ProductoStockResponse(
        Long productoId,
        String sku,
        String nombre,
        Integer stockActual,
        Integer stockMinimo,
        boolean stockBajo
) {
}
