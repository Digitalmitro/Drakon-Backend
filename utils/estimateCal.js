export function estimateShippingCost({ weightOz, country = "US", speed = "standard" }) {
    const weightLbs = weightOz / 16;
    const isDomestic = country.toUpperCase() === "US";

    const baseRates = {
        standard: isDomestic ? 3.5 : 10,
        express: isDomestic ? 7 : 25,
    };

    const perLbRates = {
        standard: isDomestic ? 0.6 : 1.5,
        express: isDomestic ? 1.25 : 3.0,
    };

    const base = baseRates[speed] || baseRates["standard"];
    const perLb = perLbRates[speed] || perLbRates["standard"];

    const estimated = base + Math.ceil(weightLbs) * perLb;
    return Number(estimated.toFixed(2));
}