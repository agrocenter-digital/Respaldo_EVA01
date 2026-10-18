package com.agrocenter.compras.service;

import com.agrocenter.compras.dto.OrdenCompraResponse;
import com.agrocenter.compras.entity.DetalleOrdenCompra;
import com.agrocenter.compras.entity.OrdenCompra;
import com.agrocenter.compras.exception.OrdenCompraNoEncontradaException;
import com.agrocenter.compras.mapper.OrdenCompraMapper;
import com.agrocenter.compras.repository.OrdenCompraRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrdenCompraPersistenceService {

    private final OrdenCompraRepository repository;
    private final OrdenCompraMapper mapper;

    @Transactional
    public OrdenCompraResponse crearPendiente(
            Long proveedorId,
            List<DetallePreparado> detalles,
            BigDecimal total
    ) {
        OrdenCompra orden = new OrdenCompra(proveedorId, total);
        detalles.forEach(detalle -> orden.agregarDetalle(new DetalleOrdenCompra(
                detalle.productoId(),
                detalle.cantidad(),
                detalle.precioUnitario(),
                detalle.subtotal()
        )));
        return mapper.toResponse(repository.saveAndFlush(orden));
    }

    @Transactional
    public OrdenCompraResponse completar(Long ordenId) {
        OrdenCompra orden = buscarEntidad(ordenId);
        orden.completar();
        return mapper.toResponse(orden);
    }

    @Transactional
    public OrdenCompraResponse cancelar(Long ordenId, String motivo) {
        OrdenCompra orden = buscarEntidad(ordenId);
        orden.cancelar(motivo);
        return mapper.toResponse(orden);
    }

    @Transactional(readOnly = true)
    public List<OrdenCompraResponse> listarTodas() {
        return repository.findAllByOrderByFechaCreacionDesc().stream()
                .map(mapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrdenCompraResponse obtenerPorId(Long id) {
        return mapper.toResponse(buscarEntidad(id));
    }

    private OrdenCompra buscarEntidad(Long id) {
        return repository.findWithDetallesById(id)
                .orElseThrow(OrdenCompraNoEncontradaException::new);
    }
}
