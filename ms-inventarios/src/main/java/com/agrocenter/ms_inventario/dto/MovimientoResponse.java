package com.agrocenter.ms_inventario.dto;

import com.agrocenter.ms_inventario.entity.OrigenMovimiento;
import com.agrocenter.ms_inventario.entity.TipoMovimiento;

import java.time.Instant;

public record MovimientoResponse(
        Long id,
        Long productoId,
        String sku,
        TipoMovimiento tipoMovimiento,
        Integer cantidad,
        Integer stockAnterior,
        Integer stockPosterior,
        String referencia,
        OrigenMovimiento origen,
        Instant fecha
) {
}
