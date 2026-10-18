package com.agrocenter.compras.exception;

import org.springframework.http.HttpStatus;

public class SolicitudInvalidaException extends ApiException {

    public SolicitudInvalidaException(String code, String message) {
        super(HttpStatus.BAD_REQUEST, code, message);
    }
}
