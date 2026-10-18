package com.agrocenter.compras.exception;

import org.springframework.http.HttpStatus;

public class ProductoNoEncontradoException extends ApiException {

    public ProductoNoEncontradoException() {
        super(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "Producto no encontrado en inventario");
    }
}
