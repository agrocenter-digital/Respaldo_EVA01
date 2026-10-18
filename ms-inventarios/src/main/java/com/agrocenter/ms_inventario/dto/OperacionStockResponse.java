package com.agrocenter.ms_inventario.dto;

import com.agrocenter.ms_inventario.entity.TipoMovimiento;

import java.time.Instant;

public record OperacionStockResponse(
        Long movimientoId,
        Long productoId,
        String sku,
        TipoMovimiento tipoMovimiento,
        Integer cantidad,
        Integer stockAnterior,
        Integer stockPosterior,
        String referencia,
        boolean duplicada,
        Instant fecha
) {
}
