package com.agrocenter.compras.controller;

import com.agrocenter.compras.dto.OrdenCompraRequest;
import com.agrocenter.compras.dto.OrdenCompraResponse;
import com.agrocenter.compras.observability.CorrelationIdFilter;
import com.agrocenter.compras.service.OrdenCompraService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/compras", "/api/compras/", "/compras", "/compras/"})
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'SCOPE_compras.read', 'SCOPE_compras.write')")
@Tag(name = "Compras", description = "Ordenes de compra y reabastecimiento")
public class OrdenCompraController {

    private final OrdenCompraService service;

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'SCOPE_compras.write')")
    @Operation(summary = "Crear una orden y registrar su entrada en inventario")
    public ResponseEntity<OrdenCompraResponse> crearOrden(
            @Valid @RequestBody OrdenCompraRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest servletRequest
    ) {
        OrdenCompraResponse nuevaOrden = service.crearOrden(
                request,
                jwt.getTokenValue(),
                CorrelationIdFilter.from(servletRequest)
        );
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(nuevaOrden.id())
                .toUri();
        return ResponseEntity.created(location).body(nuevaOrden);
    }

    @GetMapping
    @Operation(summary = "Listar las ordenes de compra")
    public ResponseEntity<List<OrdenCompraResponse>> listarOrdenes() {
        return ResponseEntity.ok(service.listarTodas());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar una orden de compra")
    public ResponseEntity<OrdenCompraResponse> obtenerPorId(@PathVariable @Positive Long id) {
        return ResponseEntity.ok(service.obtenerPorId(id));
    }
}
