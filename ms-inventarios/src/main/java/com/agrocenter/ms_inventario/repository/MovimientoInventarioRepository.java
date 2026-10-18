package com.agrocenter.ms_inventario.repository;

import com.agrocenter.ms_inventario.entity.MovimientoInventario;
import com.agrocenter.ms_inventario.entity.TipoMovimiento;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MovimientoInventarioRepository extends JpaRepository<MovimientoInventario, Long> {

    Optional<MovimientoInventario> findByProductoIdAndTipoMovimientoAndReferencia(
            Long productoId,
            TipoMovimiento tipoMovimiento,
            String referencia
    );

    Page<MovimientoInventario> findAllByOrderByFechaDesc(Pageable pageable);

    Page<MovimientoInventario> findByProductoIdOrderByFechaDesc(Long productoId, Pageable pageable);
}
