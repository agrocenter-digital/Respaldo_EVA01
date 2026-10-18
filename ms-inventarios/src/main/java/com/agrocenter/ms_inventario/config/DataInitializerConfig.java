package com.agrocenter.ms_inventario.config;

import com.agrocenter.ms_inventario.entity.Producto;
import com.agrocenter.ms_inventario.repository.ProductoRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.util.List;

@Slf4j
@Configuration
public class DataInitializerConfig {

    @Bean
    CommandLineRunner inicializarCatalogoInicial(ProductoRepository productoRepository) {
        return args -> {
            if (productoRepository.count() == 0) {
                log.info("Tabla de productos vacía. Inicializando catálogo inicial de productos agrícolas...");

                Producto maiz = new Producto(
                        "SEM-MAIZ-001",
                        "Semillas de Maíz Híbrido 25 kg",
                        "Semillas de maíz de alto rendimiento para siembra en zonas templadas.",
                        "Semillas",
                        new BigDecimal("45990.00"),
                        10
                );
                maiz.incrementarStock(50);

                Producto trigo = new Producto(
                        "SEM-TRIG-002",
                        "Semilla de Trigo Certificada 40 kg",
                        "Trigo de primavera de ciclo intermedio con alta resistencia a enfermedades.",
                        "Semillas",
                        new BigDecimal("38990.00"),
                        10
                );
                trigo.incrementarStock(40);

                Producto fertilizanteNpk = new Producto(
                        "FERT-NPK-001",
                        "Fertilizante NPK Granulado 25 kg",
                        "Mezcla equilibrada para apoyar el desarrollo vegetativo y nutrición homogénea.",
                        "Fertilizantes",
                        new BigDecimal("31990.00"),
                        15
                );
                fertilizanteNpk.incrementarStock(60);

                Producto urea = new Producto(
                        "FERT-UREA-002",
                        "Urea Agrícola 46% Nitrógeno 50 kg",
                        "Fertilizante nitrogenado de alta concentración para estimular el crecimiento vegetal.",
                        "Fertilizantes",
                        new BigDecimal("34990.00"),
                        10
                );
                urea.incrementarStock(35);

                Producto tijeras = new Producto(
                        "HERR-TIJ-001",
                        "Tijeras de Podar Profesional Bypass",
                        "Corte limpio y preciso con hoja de acero forjado y mangos ergonómicos.",
                        "Herramientas",
                        new BigDecimal("18990.00"),
                        5
                );
                tijeras.incrementarStock(30);

                List<Producto> iniciales = List.of(maiz, trigo, fertilizanteNpk, urea, tijeras);
                productoRepository.saveAll(iniciales);

                log.info("Catálogo inicial cargado exitosamente en Amazon RDS / base de datos con {} productos.", iniciales.size());
            } else {
                log.info("La base de datos ya contiene {} productos registrados. Se omite la inicialización de datos.", productoRepository.count());
            }
        };
    }
}
