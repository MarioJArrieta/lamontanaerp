"""Seed script: creates admin user, products, employees, clients, bobinas, production, sales, and inventory."""
import asyncio
from datetime import date, timedelta
from decimal import Decimal

from app.application.services.auth_service import AuthService
from app.application.services.bobina_service import BobinaService
from app.application.services.client_service import ClientService
from app.application.services.employee_service import EmployeeService
from app.application.services.inventory_service import InventoryService
from app.application.services.product_service import ProductService
from app.application.services.production_service import ProductionService
from app.application.services.sale_service import SaleService
from app.domain.enums import (
    ClientType,
    EmployeeRole,
    PaymentMethod,
    PaymentType,
    PayPeriod,
    ProductType,
    UserRole,
)
from app.infrastructure.database import async_session_factory, engine
from app.domain.aggregates import Base


async def seed():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        # ── Admin user ──
        auth_service = AuthService(session)
        try:
            await auth_service.create_user(
                username="marioarrieta.100@gmail.com",
                password="Mario.100",
                full_name="Mario Arrieta",
                role=UserRole.ADMIN,
            )
            print("Admin user created")
        except ValueError:
            print("Admin user already exists")

        try:
            await auth_service.create_user(
                username="delivery",
                password="delivery123",
                full_name="Pedro Repartidor",
                role=UserRole.DELIVERY,
            )
            print("Delivery user created: delivery / delivery123")
        except ValueError:
            print("Delivery user already exists")

        # ── Products ──
        product_service = ProductService(session)
        products = await product_service.get_all()
        if not products:
            await product_service.create(
                name="Paca de Agua x40",
                product_type=ProductType.PACA_X40,
                unit="paca",
                base_price=5000,
            )
            await product_service.create(
                name="Botellon 20 Litros",
                product_type=ProductType.BOTELLON_20L,
                unit="botellon",
                base_price=8000,
            )
            await session.flush()
            products = await product_service.get_all()
            print("Products created")
        else:
            print("Products already exist")

        paca_product = next((p for p in products if p.product_type == ProductType.PACA_X40), None)
        botellon_product = next((p for p in products if p.product_type == ProductType.BOTELLON_20L), None)

        # ── Employees ──
        employee_service = EmployeeService(session)
        existing_employees = await employee_service.get_all()
        if not existing_employees:
            emp_carlos = await employee_service.create(
                name="Carlos Ramirez",
                cedula="1098765432",
                role=EmployeeRole.PACKER,
                pay_period=PayPeriod.WEEKLY,
                rate_per_paca=Decimal("200"),
                phone="3101234567",
            )
            emp_juan = await employee_service.create(
                name="Juan Lopez",
                cedula="1087654321",
                role=EmployeeRole.PACKER,
                pay_period=PayPeriod.WEEKLY,
                rate_per_paca=Decimal("200"),
                phone="3109876543",
            )
            emp_pedro = await employee_service.create(
                name="Pedro Martinez",
                cedula="1076543210",
                role=EmployeeRole.DELIVERY,
                pay_period=PayPeriod.WEEKLY,
                rate_per_paca=Decimal("150"),
                phone="3112345678",
            )
            emp_maria = await employee_service.create(
                name="Maria Garcia",
                cedula="1065432109",
                role=EmployeeRole.SECRETARY,
                pay_period=PayPeriod.MONTHLY,
                fixed_salary=Decimal("1300000"),
                phone="3156789012",
            )
            await session.flush()
            print("Employees created: Carlos (packer), Juan (packer), Pedro (delivery), Maria (secretary)")
        else:
            emp_carlos = next((e for e in existing_employees if e.role == EmployeeRole.PACKER), existing_employees[0])
            emp_pedro = next((e for e in existing_employees if e.role == EmployeeRole.DELIVERY), existing_employees[0])
            print("Employees already exist")

        # ── Clients ──
        client_service = ClientService(session)
        existing_clients = await client_service.get_all()
        if not existing_clients:
            client_tienda = await client_service.create(
                name="Tienda Don Jose",
                client_type=ClientType.PERSON,
                cedula_nit="900123456",
                address="Calle 10 #5-20, Centro",
                delivery_zone="Centro",
                phone="3201234567",
            )
            client_supermercado = await client_service.create(
                name="Supermercado El Ahorro",
                client_type=ClientType.COMPANY,
                cedula_nit="900654321-1",
                address="Carrera 15 #20-30",
                delivery_zone="Norte",
                phone="3209876543",
                email="elahorro@email.com",
            )
            client_restaurante = await client_service.create(
                name="Restaurante La Esquina",
                client_type=ClientType.COMPANY,
                cedula_nit="900111222-3",
                address="Avenida 5 #12-45",
                delivery_zone="Sur",
                phone="3215551234",
            )
            client_miscelanea = await client_service.create(
                name="Miscelanea Doña Rosa",
                client_type=ClientType.PERSON,
                cedula_nit="51234567",
                address="Calle 3 #8-12, Barrio Nuevo",
                delivery_zone="Centro",
                phone="3187654321",
            )
            client_hotel = await client_service.create(
                name="Hotel Montaña Azul",
                client_type=ClientType.COMPANY,
                cedula_nit="900333444-5",
                address="Km 3 Via al Lago",
                delivery_zone="Rural",
                phone="3221112233",
                email="recepcion@montanaazul.co",
            )
            await session.flush()
            print("Clients created: Tienda Don Jose, Supermercado El Ahorro, Restaurante La Esquina, Miscelanea Doña Rosa, Hotel Montaña Azul")
        else:
            client_tienda = existing_clients[0]
            client_supermercado = existing_clients[1] if len(existing_clients) > 1 else existing_clients[0]
            print("Clients already exist")

        # ── Bobinas ──
        bobina_service = BobinaService(session)
        existing_bobinas = await bobina_service.get_all()
        if not existing_bobinas:
            bob1 = await bobina_service.register(
                weight_kg=Decimal("120"),
                cost=Decimal("350000"),
                estimated_pacas=250,
                supplier="Plasticos del Valle",
                notes="Bobina transparente",
            )
            bob2 = await bobina_service.register(
                weight_kg=Decimal("100"),
                cost=Decimal("280000"),
                estimated_pacas=200,
                supplier="Empaques Colombia",
            )
            await session.flush()
            print("Bobinas created: 120kg, 100kg")
        else:
            bob1 = existing_bobinas[0]
            print("Bobinas already exist")

        # ── Initial inventory (stock adjustment) ──
        inventory_service = InventoryService(session)
        existing_inv = await inventory_service.get_all()
        if not existing_inv and paca_product and botellon_product:
            await inventory_service.adjust(
                product_id=paca_product.id,
                quantity=100,
                notes="Stock inicial de prueba",
            )
            await inventory_service.adjust(
                product_id=botellon_product.id,
                quantity=30,
                notes="Stock inicial de prueba",
            )
            await session.flush()
            print("Initial inventory: 100 pacas, 30 botellones")
        else:
            print("Inventory already exists")

        # ── Production records (last 7 days) ──
        production_service = ProductionService(session)
        today = date.today()
        # Check if production already exists
        existing_prod = await production_service.get_by_date_range(
            today - timedelta(days=30), today
        )
        if not existing_prod and paca_product:
            for days_ago in [7, 6, 5, 4, 3, 2, 1]:
                prod_date = today - timedelta(days=days_ago)
                pacas = 40 + (days_ago * 5)  # vary production
                botellones = 5 + days_ago
                await production_service.register_production(
                    production_date=prod_date,
                    employee_id=emp_carlos.id,
                    pacas_produced=pacas,
                    botellones_produced=botellones,
                    waste_pacas=2,
                    bobina_id=bob1.id if days_ago <= 4 else None,
                    notes=f"Produccion dia {prod_date.isoformat()}",
                )
            await session.flush()
            print("Production records created (7 days)")
        else:
            print("Production records already exist")

        # ── Sales ──
        sale_service = SaleService(session)
        existing_sales = await sale_service.get_by_date_range(
            today - timedelta(days=30), today
        )
        if not existing_sales and paca_product and botellon_product:
            # Sale 1: cash, paid
            sale1 = await sale_service.create_sale(
                sale_date=today - timedelta(days=5),
                client_id=client_tienda.id,
                delivery_employee_id=emp_pedro.id,
                items=[
                    {"product_id": paca_product.id, "quantity": 10},
                    {"product_id": botellon_product.id, "quantity": 3},
                ],
                payment_type=PaymentType.CASH,
                notes="Pedido semanal",
            )
            await sale_service.mark_paid(sale1.id, PaymentMethod.CASH)

            # Sale 2: credit, pending
            sale2 = await sale_service.create_sale(
                sale_date=today - timedelta(days=3),
                client_id=client_supermercado.id,
                delivery_employee_id=emp_pedro.id,
                items=[
                    {"product_id": paca_product.id, "quantity": 25},
                    {"product_id": botellon_product.id, "quantity": 5},
                ],
                payment_type=PaymentType.CREDIT,
                notes="Pedido quincenal supermercado",
            )

            # Sale 3: cash, pending
            sale3 = await sale_service.create_sale(
                sale_date=today - timedelta(days=1),
                client_id=client_tienda.id,
                delivery_employee_id=emp_pedro.id,
                items=[
                    {"product_id": paca_product.id, "quantity": 15},
                ],
                payment_type=PaymentType.CASH,
                notes="Pedido urgente",
            )

            # Sale 4: credit, paid with nequi
            sale4 = await sale_service.create_sale(
                sale_date=today - timedelta(days=2),
                client_id=client_supermercado.id,
                delivery_employee_id=emp_pedro.id,
                items=[
                    {"product_id": botellon_product.id, "quantity": 8},
                ],
                payment_type=PaymentType.CREDIT,
            )
            await sale_service.mark_paid(sale4.id, PaymentMethod.NEQUI)

            # Sale 5: today, cash, pending
            sale5 = await sale_service.create_sale(
                sale_date=today,
                client_id=client_tienda.id,
                delivery_employee_id=emp_pedro.id,
                items=[
                    {"product_id": paca_product.id, "quantity": 20},
                    {"product_id": botellon_product.id, "quantity": 4},
                ],
                payment_type=PaymentType.CASH,
            )

            await session.flush()
            print("Sales created: 5 sales (2 paid, 3 pending)")
        else:
            print("Sales already exist")

        await session.commit()
        print("\nSeed complete!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
