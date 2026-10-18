package com.agrocenter.ms_inventario.controller;

import com.agrocenter.ms_inventario.dto.MovimientoResponse;
import com.agrocenter.ms_inventario.dto.PaginaResponse;
import com.agrocenter.ms_inventario.service.InventarioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/inventario", ""})
@Tag(name = "Movimientos", description = "Trazabilidad auditable de entradas y salidas")
public class MovimientoController {

    private final InventarioService inventarioService;

    @GetMapping("/movimientos")
    @Operation(summary = "Consultar todos los movimientos", description = "Requiere rol ADMIN")
    public PaginaResponse<MovimientoResponse> listar(
            @RequestParam(defaultValue = "0") @Min(0) int pagina,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int tamanio
    ) {
        return inventarioService.listarMovimientos(pagina, tamanio);
    }

    @GetMapping("/productos/{id}/movimientos")
    @Operation(summary = "Consultar movimientos de un producto", description = "Requiere rol ADMIN")
    public PaginaResponse<MovimientoResponse> listarPorProducto(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") @Min(0) int pagina,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int tamanio
    ) {
        return inventarioService.listarMovimientosPorProducto(id, pagina, tamanio);
    }
}
