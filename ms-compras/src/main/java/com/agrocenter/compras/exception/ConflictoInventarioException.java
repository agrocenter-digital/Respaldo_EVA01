package com.agrocenter.compras.exception;

import org.springframework.http.HttpStatus;

public class ConflictoInventarioException extends ApiException {

    public ConflictoInventarioException() {
        super(
                HttpStatus.CONFLICT,
                "INVENTORY_CONFLICT",
                "Inventario rechazo la operacion por un conflicto de negocio"
        );
    }
}
