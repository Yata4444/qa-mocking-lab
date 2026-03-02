import { OrderService, PaymentClient, EmailClient } from "../src/orderService";

describe("OrderService", () => {
    test("creates order and sends confirmation email on approved payment", async () => {
        const paymentClient: PaymentClient = {
            charge: jest.fn().mockResolvedValue({ status: "approved", transactionId: "tx_123" }),
        };
        const emailClient: EmailClient = {
            send: jest.fn().mockResolvedValue(undefined),
        };
        const service = new OrderService(paymentClient, emailClient);
        const result = await service.createOrder({
            userEmail: "  USER@Example.com ",
            currency: "USD",
            items: [{ sku: "A-1", qty: 2, price: 10.0 }],
            couponCode: null,
        });

        expect(result.order.userEmail).toBe("user@example.com");
        expect(result.payment.status).toBe("approved");
        expect(paymentClient.charge).toHaveBeenCalledTimes(1);
        expect(emailClient.send).toHaveBeenCalledTimes(1);
    });

    test("throws validation error for empty items", async () => {
        const paymentClient: PaymentClient = { charge: jest.fn() };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "test@example.com",
                currency: "USD",
                items: [],
            })
        ).rejects.toThrow("VALIDATION: empty items");
    });

    test("throws validation error for invalid email", async () => {
        const paymentClient: PaymentClient = { charge: jest.fn() };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "bad-email.com",
                currency: "USD",
                items: [{ sku: "ABC", qty: 1, price: 100 }],
            })
        ).rejects.toThrow("VALIDATION: invalid email");
    });

    test("throws validation error for empty sku", async () => {
        const paymentClient: PaymentClient = { charge: jest.fn() };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "test@example.com",
                currency: "USD",
                items: [{ sku: "", qty: 1, price: 100 }],
            })
        ).rejects.toThrow("VALIDATION: invalid sku");
    });

    test("throws validation error for zero quantity", async () => {
        const paymentClient: PaymentClient = { charge: jest.fn() };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "test@example.com",
                currency: "USD",
                items: [{ sku: "ABC", qty: 0, price: 100 }],
            })
        ).rejects.toThrow("VALIDATION: invalid qty");
    });

    test("throws validation error for negative price", async () => {
        const paymentClient: PaymentClient = { charge: jest.fn() };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "test@example.com",
                currency: "USD",
                items: [{ sku: "ABC", qty: 1, price: -50 }],
            })
        ).rejects.toThrow("VALIDATION: invalid price");
    });

    test("throws error for unknown coupon", async () => {
        const paymentClient: PaymentClient = { charge: jest.fn() };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "test@example.com",
                currency: "USD",
                items: [{ sku: "ABC", qty: 1, price: 100 }],
                couponCode: "FAKE-COUPON"
            })
        ).rejects.toThrow("VALIDATION: unknown coupon");
    });

    test("applies SAVE10 discount with trimming", async () => {
        const paymentClient: PaymentClient = {
            charge: jest.fn().mockResolvedValue({ status: "approved", transactionId: "tx_1" })
        };
        const emailClient: EmailClient = { send: jest.fn().mockResolvedValue(undefined) };
        const service = new OrderService(paymentClient, emailClient);

        await service.createOrder({
            userEmail: "test@example.com",
            currency: "USD",
            items: [{ sku: "ABC", qty: 1, price: 100 }],
            couponCode: " sAvE10 "
        });

        expect(paymentClient.charge).toHaveBeenCalledTimes(1);
    });

    test("applies SAVE20 discount", async () => {
        const paymentClient: PaymentClient = {
            charge: jest.fn().mockResolvedValue({ status: "approved", transactionId: "tx_2" })
        };
        const emailClient: EmailClient = { send: jest.fn().mockResolvedValue(undefined) };
        const service = new OrderService(paymentClient, emailClient);

        await service.createOrder({
            userEmail: "test@example.com",
            currency: "USD",
            items: [{ sku: "ABC", qty: 1, price: 100 }],
            couponCode: "SAVE20"
        });

        expect(paymentClient.charge).toHaveBeenCalledTimes(1);
    });

    test("applies WELCOME discount with limits", async () => {
        const paymentClient: PaymentClient = {
            charge: jest.fn().mockResolvedValue({ status: "approved", transactionId: "tx_3" })
        };
        const emailClient: EmailClient = { send: jest.fn().mockResolvedValue(undefined) };
        const service = new OrderService(paymentClient, emailClient);

        await service.createOrder({
            userEmail: "test@example.com",
            currency: "USD",
            items: [{ sku: "ABC", qty: 1, price: 1000 }],
            couponCode: "WELCOME"
        });

        expect(paymentClient.charge).toHaveBeenCalledTimes(1);
    });

    test("blocks tempmail addresses", async () => {
        const paymentClient: PaymentClient = { charge: jest.fn() };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "user@tempmail.com",
                currency: "USD",
                items: [{ sku: "ABC", qty: 1, price: 100 }]
            })
        ).rejects.toThrow("RISK: tempmail is not allowed");
    });

    test("blocks suspiciously high amounts", async () => {
        const paymentClient: PaymentClient = { charge: jest.fn() };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "test@example.com",
                currency: "USD",
                items: [{ sku: "ABC", qty: 1, price: 3000 }]
            })
        ).rejects.toThrow("RISK: amount too high");
    });

    test("blocks plus-alias with high amount", async () => {
        const paymentClient: PaymentClient = { charge: jest.fn() };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "test+123@example.com",
                currency: "USD",
                items: [{ sku: "ABC", qty: 1, price: 600 }]
            })
        ).rejects.toThrow("RISK: plus-alias high amount");
    });

    test("does not send email if payment is declined", async () => {
        const paymentClient: PaymentClient = {
            charge: jest.fn().mockResolvedValue({ status: "declined" })
        };
        const emailClient: EmailClient = { send: jest.fn() };
        const service = new OrderService(paymentClient, emailClient);

        await expect(
            service.createOrder({
                userEmail: "test@example.com",
                currency: "USD",
                items: [{ sku: "ABC", qty: 1, price: 10 }]
            })
        ).rejects.toThrow(/PAYMENT_DECLINED/);

        expect(emailClient.send).not.toHaveBeenCalled();
    });

    test("calculates multiple items correctly", async () => {
        const paymentClient: PaymentClient = {
            charge: jest.fn().mockResolvedValue({ status: "approved", transactionId: "tx_multi" })
        };
        const emailClient: EmailClient = { send: jest.fn().mockResolvedValue(undefined) };
        const service = new OrderService(paymentClient, emailClient);

        await service.createOrder({
            userEmail: "test@example.com",
            currency: "USD",
            items: [
                { sku: "ABC", qty: 2, price: 10 },
                { sku: "DEF", qty: 1, price: 5 }
            ]
        });

        expect(paymentClient.charge).toHaveBeenCalledTimes(1);
    });

    test("handles price rounding", async () => {
        const paymentClient: PaymentClient = {
            charge: jest.fn().mockResolvedValue({ status: "approved", transactionId: "tx_round" })
        };
        const emailClient: EmailClient = { send: jest.fn().mockResolvedValue(undefined) };
        const service = new OrderService(paymentClient, emailClient);

        await service.createOrder({
            userEmail: "test@example.com",
            currency: "USD",
            items: [{ sku: "ABC", qty: 1, price: 10.005 }]
        });

        expect(paymentClient.charge).toHaveBeenCalledTimes(1);
    });
});