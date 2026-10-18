package com.agrocenter.ms_inventario.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Getter
@Entity
@Table(
        name = "movimientos_inventario",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_movimiento_idempotencia",
                columnNames = {"producto_id", "tipo_movimiento", "referencia"}
        ),
        indexes = {
                @Index(name = "idx_movimiento_producto_fecha", columnList = "producto_id, fecha"),
                @Index(name = "idx_movimiento_referencia", columnList = "referencia")
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MovimientoInventario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id", nullable = false, updatable = false)
    private Producto producto;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_movimiento", nullable = false, length = 20, updatable = false)
    private TipoMovimiento tipoMovimiento;

    @Column(nullable = false, updatable = false)
    private Integer cantidad;

    @Column(nullable = false, updatable = false)
    private Integer stockAnterior;

    @Column(nullable = false, updatable = false)
    private Integer stockPosterior;

    @Column(nullable = false, length = 100, updatable = false)
    private String referencia;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30, updatable = false)
    private OrigenMovimiento origen;

    @Column(nullable = false, updatable = false)
    private Instant fecha;

    public MovimientoInventario(
            Producto producto,
            TipoMovimiento tipoMovimiento,
            Integer cantidad,
            Integer stockAnterior,
            Integer stockPosterior,
            String referencia,
            OrigenMovimiento origen
    ) {
        this.producto = producto;
        this.tipoMovimiento = tipoMovimiento;
        this.cantidad = cantidad;
        this.stockAnterior = stockAnterior;
        this.stockPosterior = stockPosterior;
        this.referencia = referencia;
        this.origen = origen;
    }

    @PrePersist
    void prePersist() {
        this.fecha = Instant.now();
    }
}
