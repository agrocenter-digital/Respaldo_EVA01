package com.agrocenter.compras.exception;

import org.springframework.http.HttpStatus;

public class IntegracionInventarioException extends ApiException {

    public IntegracionInventarioException() {
        super(
                HttpStatus.BAD_GATEWAY,
                "INVENTORY_INTEGRATION_ERROR",
                "Inventario rechazo la operacion de reabastecimiento"
        );
    }
}
