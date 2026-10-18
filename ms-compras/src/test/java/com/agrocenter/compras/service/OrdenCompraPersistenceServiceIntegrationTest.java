package com.agrocenter.compras.service;

import com.agrocenter.compras.dto.OrdenCompraResponse;
import com.agrocenter.compras.entity.EstadoOrden;
import com.agrocenter.compras.mapper.OrdenCompraMapper;
import com.agrocenter.compras.repository.OrdenCompraRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class OrdenCompraPersistenceServiceIntegrationTest {

    @Autowired
    private OrdenCompraRepository repository;

    private OrdenCompraPersistenceService service;

    @BeforeEach
    void setUp() {
        service = new OrdenCompraPersistenceService(repository, new OrdenCompraMapper());
    }

    @Test
    void persisteDetallesYTransicionaLaOrdenACompletada() {
        OrdenCompraResponse pendiente = service.crearPendiente(
                7L,
                List.of(new DetallePreparado(
                        10L,
                        2,
                        new BigDecimal("100.00"),
                        new BigDecimal("200.00")
                )),
                new BigDecimal("200.00")
        );

        OrdenCompraResponse completada = service.completar(pendiente.id());
        OrdenCompraResponse recargada = service.obtenerPorId(pendiente.id());

        assertThat(completada.estado()).isEqualTo(EstadoOrden.COMPLETADA);
        assertThat(recargada.detalles()).hasSize(1);
        assertThat(recargada.detalles().getFirst().subtotal()).isEqualByComparingTo("200.00");
        assertThat(service.listarTodas()).extracting(OrdenCompraResponse::id)
                .containsExactly(pendiente.id());
    }
}
