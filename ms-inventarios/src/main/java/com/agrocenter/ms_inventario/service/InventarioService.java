package com.agrocenter.ms_inventario.service;

import com.agrocenter.ms_inventario.dto.DisponibilidadRequest;
import com.agrocenter.ms_inventario.dto.DisponibilidadResponse;
import com.agrocenter.ms_inventario.dto.MovimientoResponse;
import com.agrocenter.ms_inventario.dto.OperacionStockRequest;
import com.agrocenter.ms_inventario.dto.OperacionStockResponse;
import com.agrocenter.ms_inventario.dto.PaginaResponse;
import com.agrocenter.ms_inventario.dto.ProductoStockResponse;
import com.agrocenter.ms_inventario.entity.MovimientoInventario;
import com.agrocenter.ms_inventario.entity.OrigenMovimiento;
import com.agrocenter.ms_inventario.entity.Producto;
import com.agrocenter.ms_inventario.entity.TipoMovimiento;
import com.agrocenter.ms_inventario.exception.ConflictoNegocioException;
import com.agrocenter.ms_inventario.exception.RecursoNoEncontradoException;
import com.agrocenter.ms_inventario.mapper.InventarioMapper;
import com.agrocenter.ms_inventario.repository.MovimientoInventarioRepository;
import com.agrocenter.ms_inventario.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventarioService {

    private final ProductoRepository productoRepository;
    private final MovimientoInventarioRepository movimientoRepository;
    private final InventarioMapper mapper;

    @Transactional(readOnly = true)
    public ProductoStockResponse consultarStock(Long productoId, boolean incluirInactivos) {
        Producto producto = buscarProducto(productoId);
        if (!incluirInactivos && !producto.isActivo()) {
            throw new RecursoNoEncontradoException("Producto no encontrado");
        }
        return mapper.toStockResponse(producto);
    }

    @Transactional(readOnly = true)
    public DisponibilidadResponse validarDisponibilidad(DisponibilidadRequest request) {
        Producto producto = buscarProducto(request.productoId());
        boolean disponible = producto.isActivo() && producto.getStockActual() >= request.cantidad();
        return new DisponibilidadResponse(
                producto.getId(),
                disponible,
                producto.getStockActual(),
                request.cantidad()
        );
    }

    @Transactional
    public OperacionStockResponse registrarEntrada(OperacionStockRequest request) {
        return procesarMovimiento(request, TipoMovimiento.ENTRADA, OrigenMovimiento.MS_COMPRAS);
    }

    @Transactional
    public OperacionStockResponse registrarSalida(OperacionStockRequest request) {
        return procesarMovimiento(request, TipoMovimiento.SALIDA, OrigenMovimiento.MS_VENTAS);
    }

    @Transactional(readOnly = true)
    public PaginaResponse<MovimientoResponse> listarMovimientos(int pagina, int tamanio) {
        Page<MovimientoInventario> movimientos = movimientoRepository
                .findAllByOrderByFechaDesc(PageRequest.of(pagina, tamanio));
        return PaginaResponse.desde(movimientos, mapper::toMovimientoResponse);
    }

    @Transactional(readOnly = true)
    public PaginaResponse<MovimientoResponse> listarMovimientosPorProducto(
            Long productoId,
            int pagina,
            int tamanio
    ) {
        if (!productoRepository.existsById(productoId)) {
            throw new RecursoNoEncontradoException("Producto no encontrado");
        }
        Page<MovimientoInventario> movimientos = movimientoRepository
                .findByProductoIdOrderByFechaDesc(productoId, PageRequest.of(pagina, tamanio));
        return PaginaResponse.desde(movimientos, mapper::toMovimientoResponse);
    }

    private OperacionStockResponse procesarMovimiento(
            OperacionStockRequest request,
            TipoMovimiento tipo,
            OrigenMovimiento origen
    ) {
        Producto producto = productoRepository.findByIdForUpdate(request.productoId())
                .orElseThrow(() -> new RecursoNoEncontradoException("Producto no encontrado"));
        String referencia = normalizarReferencia(request.referencia());

        Optional<MovimientoInventario> existente = movimientoRepository
                .findByProductoIdAndTipoMovimientoAndReferencia(producto.getId(), tipo, referencia);
        if (existente.isPresent()) {
            log.info(
                    "Operacion idempotente detectada producto={} movimiento={} referencia={}",
                    producto.getSku(),
                    tipo,
                    referencia
            );
            return mapper.toOperacionStockResponse(existente.get(), true);
        }

        if (tipo == TipoMovimiento.SALIDA && !producto.isActivo()) {
            throw new ConflictoNegocioException("No se puede descontar stock de un producto inactivo");
        }

        int stockAnterior = producto.getStockActual();
        if (tipo == TipoMovimiento.ENTRADA) {
            producto.incrementarStock(request.cantidad());
        } else {
            producto.descontarStock(request.cantidad());
        }

        productoRepository.save(producto);
        MovimientoInventario movimiento = movimientoRepository.save(new MovimientoInventario(
                producto,
                tipo,
                request.cantidad(),
                stockAnterior,
                producto.getStockActual(),
                referencia,
                origen
        ));

        log.info(
                "Stock actualizado producto={} movimiento={} cantidad={} referencia={}",
                producto.getSku(),
                tipo,
                request.cantidad(),
                referencia
        );
        return mapper.toOperacionStockResponse(movimiento, false);
    }

    private Producto buscarProducto(Long id) {
        return productoRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Producto no encontrado"));
    }

    private String normalizarReferencia(String referencia) {
        return referencia.trim().toUpperCase(Locale.ROOT);
    }
}
