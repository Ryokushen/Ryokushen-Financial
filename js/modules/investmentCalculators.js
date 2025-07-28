/**
 * Investment Calculators Module
 * Provides calculations for investment growth projections, retirement planning,
 * and contribution scenarios
 */

export const InvestmentCalculators = (() => {
  /**
   * Calculate future value with monthly contributions
   * @param {number} presentValue - Current investment value
   * @param {number} monthlyContribution - Monthly contribution amount
   * @param {number} annualRate - Annual interest rate (as percentage)
   * @param {number} years - Number of years to project
   * @returns {Object} Future value and breakdown
   */
  const calculateFutureValue = (presentValue, monthlyContribution, annualRate, years) => {
    const monthlyRate = annualRate / 100 / 12;
    const months = years * 12;

    // Future value of existing investment
    const fvPresentValue = presentValue * Math.pow(1 + monthlyRate, months);

    // Future value of monthly contributions (annuity)
    let fvContributions = 0;
    if (monthlyRate > 0) {
      fvContributions =
        monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    } else {
      // Handle 0% interest rate
      fvContributions = monthlyContribution * months;
    }

    const totalContributed = monthlyContribution * months;
    const totalValue = fvPresentValue + fvContributions;
    const totalEarnings = totalValue - presentValue - totalContributed;

    return {
      futureValue: totalValue,
      totalContributed,
      totalEarnings,
      initialGrowth: fvPresentValue - presentValue,
      contributionGrowth: fvContributions - totalContributed,
      breakdown: {
        fromInitial: fvPresentValue,
        fromContributions: fvContributions,
      },
    };
  };

  /**
   * Calculate future value for multiple return scenarios
   * @param {number} presentValue - Current investment value
   * @param {number} monthlyContribution - Monthly contribution amount
   * @param {Array<number>} returnRates - Array of annual return rates to compare
   * @param {number} years - Number of years to project
   * @returns {Array} Results for each return rate
   */
  const calculateMultipleScenarios = (presentValue, monthlyContribution, returnRates, years) => {
    return returnRates.map(rate => ({
      rate,
      ...calculateFutureValue(presentValue, monthlyContribution, rate, years),
    }));
  };

  /**
   * Calculate required monthly contribution to reach a target
   * @param {number} targetAmount - Desired future value
   * @param {number} presentValue - Current investment value
   * @param {number} annualRate - Annual interest rate (as percentage)
   * @param {number} years - Number of years to reach target
   * @returns {number} Required monthly contribution
   */
  const calculateRequiredMonthlyContribution = (targetAmount, presentValue, annualRate, years) => {
    // Input validation
    if (targetAmount <= 0 || years <= 0) {
      return 0;
    }

    const monthlyRate = annualRate / 100 / 12;
    const months = years * 12;

    // Future value of existing investment
    const fvPresentValue = presentValue * Math.pow(1 + monthlyRate, months);

    // Amount needed from contributions
    const neededFromContributions = targetAmount - fvPresentValue;

    if (neededFromContributions <= 0) {
      return 0; // Target already achievable with current value
    }

    // Calculate required monthly contribution
    if (monthlyRate > 0) {
      const denominatorValue = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
      if (denominatorValue <= 0) {
        return neededFromContributions / months; // Fallback to simple calculation
      }
      return neededFromContributions / denominatorValue;
    } else {
      // Handle 0% interest rate
      return neededFromContributions / months;
    }
  };

  /**
   * Calculate retirement planning scenarios
   * @param {number} currentAge - Current age
   * @param {number} retirementAge - Target retirement age
   * @param {number} targetAmount - Desired retirement portfolio value
   * @param {number} currentPortfolioValue - Current total investment value
   * @param {Array<number>} returnRates - Array of annual return rates to compare
   * @returns {Object} Retirement planning results
   */
  const calculateRetirementScenarios = (
    currentAge,
    retirementAge,
    targetAmount,
    currentPortfolioValue,
    returnRates
  ) => {
    const yearsToRetirement = retirementAge - currentAge;

    if (yearsToRetirement <= 0) {
      return {
        error: 'Retirement age must be greater than current age',
        scenarios: [],
      };
    }

    const scenarios = returnRates.map(rate => {
      const requiredMonthly = calculateRequiredMonthlyContribution(
        targetAmount,
        currentPortfolioValue,
        rate,
        yearsToRetirement
      );

      const projectedValue = calculateFutureValue(
        currentPortfolioValue,
        requiredMonthly,
        rate,
        yearsToRetirement
      );

      // Ensure values are finite and non-negative
      const cleanRequiredMonthly = isFinite(requiredMonthly) ? Math.max(0, requiredMonthly) : 0;
      const totalContributions = cleanRequiredMonthly * yearsToRetirement * 12;

      return {
        rate,
        requiredMonthlyContribution: cleanRequiredMonthly,
        yearsToRetirement,
        totalContributions,
        projectedValue: isFinite(projectedValue.futureValue)
          ? projectedValue.futureValue
          : targetAmount,
        projectedEarnings: isFinite(projectedValue.totalEarnings)
          ? Math.max(0, projectedValue.totalEarnings)
          : 0,
      };
    });

    return {
      currentAge,
      retirementAge,
      targetAmount,
      currentPortfolioValue,
      scenarios,
    };
  };

  /**
   * Calculate portfolio growth over time
   * @param {number} initialValue - Starting portfolio value
   * @param {number} monthlyContribution - Monthly contribution amount
   * @param {Array<number>} returnRates - Array of annual return rates to compare
   * @param {number} maxYears - Maximum years to project
   * @returns {Object} Year-by-year projections for each rate
   */
  const calculatePortfolioGrowthTimeline = (
    initialValue,
    monthlyContribution,
    returnRates,
    maxYears
  ) => {
    const timeline = [];

    for (let year = 0; year <= maxYears; year++) {
      const yearData = {
        year,
        values: {},
      };

      returnRates.forEach(rate => {
        if (year === 0) {
          yearData.values[`rate_${rate}`] = initialValue;
        } else {
          const result = calculateFutureValue(initialValue, monthlyContribution, rate, year);
          yearData.values[`rate_${rate}`] = result.futureValue;
        }
      });

      timeline.push(yearData);
    }

    return {
      timeline,
      returnRates,
      initialValue,
      monthlyContribution,
    };
  };

  /**
   * Calculate inflation-adjusted values
   * @param {number} futureValue - Nominal future value
   * @param {number} inflationRate - Annual inflation rate (as percentage)
   * @param {number} years - Number of years
   * @returns {number} Real value in today's dollars
   */
  const adjustForInflation = (futureValue, inflationRate, years) => {
    return futureValue / Math.pow(1 + inflationRate / 100, years);
  };

  /**
   * Calculate compound annual growth rate (CAGR)
   * @param {number} beginningValue - Starting value
   * @param {number} endingValue - Ending value
   * @param {number} years - Number of years
   * @returns {number} CAGR as percentage
   */
  const calculateCAGR = (beginningValue, endingValue, years) => {
    if (beginningValue <= 0 || years <= 0) {
      return 0;
    }
    return (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100;
  };

  /**
   * Validate calculator inputs
   * @param {Object} inputs - Input values to validate
   * @returns {Object} Validation result
   */
  const validateInputs = inputs => {
    const errors = [];

    if (inputs.presentValue !== undefined && inputs.presentValue < 0) {
      errors.push('Present value cannot be negative');
    }

    if (inputs.monthlyContribution !== undefined && inputs.monthlyContribution < 0) {
      errors.push('Monthly contribution cannot be negative');
    }

    if (inputs.years !== undefined && (inputs.years <= 0 || inputs.years > 100)) {
      errors.push('Years must be between 1 and 100');
    }

    if (inputs.annualRate !== undefined && (inputs.annualRate < -20 || inputs.annualRate > 50)) {
      errors.push('Annual return rate must be between -20% and 50%');
    }

    if (inputs.currentAge !== undefined && (inputs.currentAge < 0 || inputs.currentAge > 120)) {
      errors.push('Current age must be between 0 and 120');
    }

    if (
      inputs.retirementAge !== undefined &&
      (inputs.retirementAge < 0 || inputs.retirementAge > 120)
    ) {
      errors.push('Retirement age must be between 0 and 120');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  return {
    calculateFutureValue,
    calculateMultipleScenarios,
    calculateRequiredMonthlyContribution,
    calculateRetirementScenarios,
    calculatePortfolioGrowthTimeline,
    adjustForInflation,
    calculateCAGR,
    validateInputs,
  };
})();
