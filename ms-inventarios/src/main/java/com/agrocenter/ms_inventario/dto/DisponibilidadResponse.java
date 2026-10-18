package com.agrocenter.ms_inventario.dto;

public record DisponibilidadResponse(
        Long productoId,
        boolean disponible,
        Integer stockActual,
        Integer cantidadSolicitada
) {
}
