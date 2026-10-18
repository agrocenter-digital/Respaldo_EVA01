package com.agrocenter.ms_inventario.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RecursoNoEncontradoException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(
            RecursoNoEncontradoException exception,
            HttpServletRequest request
    ) {
        return respuesta(HttpStatus.NOT_FOUND, "NOT_FOUND", exception.getMessage(), request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleRouteNotFound(
            NoResourceFoundException exception,
            HttpServletRequest request
    ) {
        return respuesta(
                HttpStatus.NOT_FOUND,
                "NOT_FOUND",
                "No existe un recurso para la ruta solicitada",
                request
        );
    }

    @ExceptionHandler(ConflictoNegocioException.class)
    public ResponseEntity<ApiErrorResponse> handleConflict(
            ConflictoNegocioException exception,
            HttpServletRequest request
    ) {
        log.warn("Conflicto de negocio path={} message={}", request.getRequestURI(), exception.getMessage());
        return respuesta(HttpStatus.CONFLICT, "CONFLICT", exception.getMessage(), request);
    }

    @ExceptionHandler({
            ObjectOptimisticLockingFailureException.class,
            PessimisticLockingFailureException.class
    })
    public ResponseEntity<ApiErrorResponse> handleConcurrency(
            RuntimeException exception,
            HttpServletRequest request
    ) {
        log.warn("Conflicto de concurrencia path={}", request.getRequestURI());
        return respuesta(
                HttpStatus.CONFLICT,
                "CONCURRENT_UPDATE",
                "El inventario fue actualizado por otra operacion; intente nuevamente",
                request
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleIntegrity(
            DataIntegrityViolationException exception,
            HttpServletRequest request
    ) {
        log.warn("Conflicto de integridad path={}", request.getRequestURI());
        return respuesta(
                HttpStatus.CONFLICT,
                "DATA_CONFLICT",
                "La operacion entra en conflicto con datos existentes",
                request
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        Map<String, String> errores = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                errores.putIfAbsent(error.getField(), error.getDefaultMessage())
        );
        ApiErrorResponse body = new ApiErrorResponse(
                Instant.now(),
                HttpStatus.BAD_REQUEST.value(),
                "VALIDATION_ERROR",
                "La solicitud contiene datos invalidos",
                request.getRequestURI(),
                errores
        );
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request
    ) {
        return respuesta(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_ERROR",
                "La solicitud contiene parametros invalidos",
                request
        );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadable(
            HttpMessageNotReadableException exception,
            HttpServletRequest request
    ) {
        return respuesta(
                HttpStatus.BAD_REQUEST,
                "MALFORMED_JSON",
                "El cuerpo de la solicitud no es valido",
                request
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(
            Exception exception,
            HttpServletRequest request
    ) {
        log.error("Error no controlado path={}", request.getRequestURI(), exception);
        return respuesta(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Ocurrio un error interno",
                request
        );
    }

    private ResponseEntity<ApiErrorResponse> respuesta(
            HttpStatus status,
            String error,
            String message,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(status).body(
                ApiErrorResponse.of(status.value(), error, message, request.getRequestURI())
        );
    }
}
