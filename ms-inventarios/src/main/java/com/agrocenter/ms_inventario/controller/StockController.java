package com.agrocenter.ms_inventario.controller;

import com.agrocenter.ms_inventario.dto.DisponibilidadRequest;
import com.agrocenter.ms_inventario.dto.DisponibilidadResponse;
import com.agrocenter.ms_inventario.dto.OperacionStockRequest;
import com.agrocenter.ms_inventario.dto.OperacionStockResponse;
import com.agrocenter.ms_inventario.service.InventarioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/inventario/stock", "/stock"})
@Tag(name = "Stock", description = "Disponibilidad, entradas y salidas de inventario")
public class StockController {

    private final InventarioService inventarioService;

    @PostMapping("/validar")
    @Operation(summary = "Validar disponibilidad para una cantidad solicitada")
    public DisponibilidadResponse validar(@Valid @RequestBody DisponibilidadRequest request) {
        return inventarioService.validarDisponibilidad(request);
    }

    @PostMapping("/entrada")
    @Operation(
            summary = "Incrementar stock",
            description = "Operacion idempotente destinada a ms-compras o a un ADMIN"
    )
    public OperacionStockResponse entrada(@Valid @RequestBody OperacionStockRequest request) {
        return inventarioService.registrarEntrada(request);
    }

    @PostMapping("/salida")
    @Operation(
            summary = "Descontar stock",
            description = "Operacion idempotente destinada a ms-ventas; responde 409 si el stock es insuficiente"
    )
    public OperacionStockResponse salida(@Valid @RequestBody OperacionStockRequest request) {
        return inventarioService.registrarSalida(request);
    }
}
