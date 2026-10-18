package com.agrocenter.compras.exception;

import org.springframework.http.HttpStatus;

public class OrdenCompraNoEncontradaException extends ApiException {

    public OrdenCompraNoEncontradaException() {
        super(HttpStatus.NOT_FOUND, "PURCHASE_NOT_FOUND", "Orden de compra no encontrada");
    }
}
