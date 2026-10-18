package com.agrocenter.compras.repository;

import com.agrocenter.compras.entity.OrdenCompra;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;
import java.util.Optional;

public interface OrdenCompraRepository extends JpaRepository<OrdenCompra, Long> {

    @EntityGraph(attributePaths = "detalles")
    Optional<OrdenCompra> findWithDetallesById(Long id);

    @EntityGraph(attributePaths = "detalles")
    List<OrdenCompra> findAllByOrderByFechaCreacionDesc();
}
