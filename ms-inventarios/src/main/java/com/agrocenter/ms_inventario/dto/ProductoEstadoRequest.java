package com.agrocenter.ms_inventario.dto;

import jakarta.validation.constraints.NotNull;

public record ProductoEstadoRequest(@NotNull Boolean activo) {
}
