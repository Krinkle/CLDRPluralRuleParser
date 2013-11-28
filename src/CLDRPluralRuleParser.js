/**
 * cldrpluralparser.js
 * A parser engine for CLDR plural rules.
 *
 * Copyright 2012-2013 GPLV3+
 *
 * @version 0.1.0
 * @source https://github.com/santhoshtr/CLDRPluralRuleParser
 * @author Santhosh Thottingal <santhosh.thottingal@gmail.com>
 * @author Timo Tijhof
 * @author Amir Aharoni
 */

/**
 * Evaluates a plural rule in CLDR syntax for a number
 * @param rule
 * @param number
 * @return true|false|null true if evaluation passed, false if evaluation failed.
 * 		null if parsing failed.
 */
function pluralRuleParser(rule, number) {
	/*
	Syntax: see http://unicode.org/reports/tr35/#Language_Plural_Rules
	-----------------------------------------------------------------
	condition     = and_condition ('or' and_condition)*
                ('@integer' samples)?
                ('@decimal' samples)?
	and_condition = relation ('and' relation)*
	relation      = is_relation | in_relation | within_relation
	is_relation   = expr 'is' ('not')? value
	in_relation   = expr (('not')? 'in' | '=' | '!=') range_list
	within_relation = expr ('not')? 'within' range_list
	expr          = operand (('mod' | '%') value)?
	operand       = 'n' | 'i' | 'f' | 't' | 'v' | 'w'
	range_list    = (range | value) (',' range_list)*
	value         = digit+
	digit         = 0|1|2|3|4|5|6|7|8|9
	range         = value'..'value
	samples       = sampleRange (',' sampleRange)* (',' ('…'|'...'))?
	sampleRange   = decimalValue '~' decimalValue
	decimalValue  = value ('.' value)?
	*/

	// we don't evaluate the samples section of the rule. Ignore it.
	rule = rule.substr(0, rule.indexOf('@')).trim();

	if (!rule.length) {
		// empty rule or 'other' rule.
		return true;
	}
	// Indicates current position in the rule as we parse through it.
	// Shared among all parsing functions below.
	var pos = 0,
		operand,
		expression,
		relation,
		result,
		whitespace = makeRegexParser(/^\s+/),
		// value         = digit+
		value = makeRegexParser(/^\d+/),
		decimal = makeRegexParser(/^\d+\.?\d*/),
		_n_ = makeStringParser('n'),
		_i_ = makeStringParser('i'),
		_f_ = makeStringParser('f'),
		_t_ = makeStringParser('t'),
		_v_ = makeStringParser('v'),
		_w_ = makeStringParser('w'),
		_is_ = makeStringParser('is'),
		_isnot_ = makeStringParser('is not'),
		_isnot_sign_ = makeStringParser('!='),
		_equal_ = makeStringParser('='),
		_mod_ = makeStringParser('mod'),
		_percent_ = makeStringParser('%'),
		_not_ = makeStringParser('not'),
		_in_ = makeStringParser('in'),
		_within_ = makeStringParser('within'),
		_range_ = makeStringParser('..'),
		_comma_ = makeStringParser(','),
		_or_ = makeStringParser('or'),
		_and_ = makeStringParser('and');

	function debug() {
		//console.log.apply(console, arguments);
	}

	debug('pluralRuleParser', rule, number);

	// Try parsers until one works, if none work return null
	function choice(parserSyntax) {
		return function() {
			for (var i = 0; i < parserSyntax.length; i++) {
				var result = parserSyntax[i]();
				if (result !== null) {
					return result;
				}
			}
			return null;
		};
	}

	// Try several parserSyntax-es in a row.
	// All must succeed; otherwise, return null.
	// This is the only eager one.
	function sequence(parserSyntax) {
		var originalPos = pos;
		var result = [];
		for (var i = 0; i < parserSyntax.length; i++) {
			var res = parserSyntax[i]();
			if (res === null) {
				pos = originalPos;
				return null;
			}
			result.push(res);
		}
		return result;
	}

	// Run the same parser over and over until it fails.
	// Must succeed a minimum of n times; otherwise, return null.
	function nOrMore(n, p) {
		return function() {
			var originalPos = pos;
			var result = [];
			var parsed = p();
			while (parsed !== null) {
				result.push(parsed);
				parsed = p();
			}
			if (result.length < n) {
				pos = originalPos;
				return null;
			}
			return result;
		};
	}

	// Helpers -- just make parserSyntax out of simpler JS builtin types

	function makeStringParser(s) {
		var len = s.length;
		return function() {
			var result = null;
			if (rule.substr(pos, len) === s) {
				result = s;
				pos += len;
			}

			return result;
		};
	}

	function makeRegexParser(regex) {
		return function() {
			var matches = rule.substr(pos).match(regex);
			if (matches === null) {
				return null;
			}
			pos += matches[0].length;
			return matches[0];
		};
	}

	/*
	 * integer digits of n.
	 */
	function i() {
		var result = _i_();
		if (result === null) {
			debug(' -- failed i');
			return result;
		}
		result = parseInt(number);
		debug(' -- passed i ', result);
		return result;
	}

	/*
	 * absolute value of the source number (integer and decimals).
	 */
	function n() {
		var result = _n_();
		if (result === null) {
			debug(' -- failed n');
			return result;
		}
		result = parseFloat(number);
		debug(' -- passed n ', result);
		return result;
	}

	/*
	 * visible fractional digits in n, with trailing zeros.
	 */
	function f() {
		var result = _f_();
		if (result === null) {
			debug(' -- failed f');
			return result;
		}
		result = number % 1;
		debug(' -- passed f ', result);
		return result;
	}

	/*
	 * visible fractional digits in n, without trailing zeros.
	 */
	function t() {
		var result = _t_();
		if (result === null) {
			debug(' -- failed t');
			return result;
		}
		result = parseInt(((number % 1) + '').replace(/0$/, '')) || 0;
		debug(' -- passed t ', result);
		return result;
	}

	/*
	 * number of visible fraction digits in n, with trailing zeros.
	 */
	function v() {
		var result = _v_();
		if (result === null) {
			debug(' -- failed v');
			return result;
		}
		result = parseInt(number % 1) + ''.length;
		debug(' -- passed v ', result);
		return result;
	}

	/*
	 * number of visible fraction digits in n, without trailing zeros.
	 */
	function w() {
		var result = _v_();
		if (result === null) {
			debug(' -- failed w');
			return result;
		}
		result = parseInt(((number % 1) + '').replace(/0$/, '')).length || 0;
		debug(' -- passed w ', result);
		return result;
	}

	// operand       = 'n' | 'i' | 'f' | 't' | 'v' | 'w'
	operand = choice([n, i, f, t, v, w]);

	// expr          = operand (('mod' | '%') value)?
	expression = choice([mod, operand]);

	function mod() {
		var result = sequence([operand, whitespace, choice([_mod_, _percent_]), whitespace, value]);
		if (result === null) {
			debug(' -- failed mod');
			return null;
		}
		debug(' -- passed ' + parseInt(result[0], 10) + ' ' + result[2] + ' ' + parseInt(result[4], 10));
		return parseInt(result[0], 10) % parseInt(result[4], 10);
	}

	function not() {
		var result = sequence([whitespace, _not_]);
		if (result === null) {
			debug(' -- failed not');
			return null;
		}

		return result[1];
	}

	// is_relation   = expr 'is' ('not')? value
	function is() {
		var result = sequence([expression, whitespace, _is_, whitespace, value]);
		if (result !== null) {
			debug(' -- passed is : ' + result[0] + ' == ' + parseInt(result[4], 10));
			return result[0] === parseInt(result[4], 10);
		}
		debug(' -- failed is');
		return null;
	}

	// is_relation   = expr 'is' ('not')? value
	function isnot() {
		var result = sequence([expression, whitespace, choice([_isnot_, _isnot_sign_]), whitespace, value]);
		if (result !== null) {
			debug(' -- passed isnot: ' + result[0] + ' != ' + parseInt(result[4], 10));
			return result[0] !== parseInt(result[4], 10);
		}
		debug(' -- failed isnot');
		return null;
	}

	function not_in() {
		var result = sequence([expression, whitespace, _isnot_sign_, whitespace, rangeList]);
		if (result !== null) {
			debug(' -- passed not_in: ' + result[0] + ' != ' + result[4]);
			var range_list = result[4];
			for (var i = 0; i < range_list.length; i++) {
				if (parseInt(range_list[i], 10) === result[0]) {
					return false;
				}
			}
			return true;
		}
		debug(' -- failed not_in');
		return null;
	}

	// range_list    = (range | value) (',' range_list)*
	function rangeList() {
		var result = sequence([choice([range, value]), nOrMore(0, rangeTail)]);
		var resultList = [];
		if (result !== null) {
			resultList = resultList.concat(result[0]);
			if (result[1][0]) {
				resultList = resultList.concat(result[1][0]);
			}
			return resultList;
		}
		debug(' -- failed rangeList');
		return null;
	}

	function rangeTail() {
		// ',' range_list
		var result = sequence([_comma_, rangeList]);
		if (result !== null) {
			return result[1];
		}
		debug(' -- failed rangeTail');
		return null;
	}

	// range         = value'..'value
	function range() {
		var i;
		var result = sequence([value, _range_, value]);
		if (result !== null) {
			debug(' -- passed range');
			var array = [];
			var left = parseInt(result[0], 10);
			var right = parseInt(result[2], 10);
			for (i = left; i <= right; i++) {
				array.push(i);
			}
			return array;
		}
		debug(' -- failed range');
		return null;
	}

	function _in() {
		// in_relation   = expr ('not')? 'in' range_list
		var result = sequence([expression, nOrMore(0, not), whitespace, choice([_in_, _equal_]), whitespace, rangeList]);
		if (result !== null) {
			debug(' -- passed _in');
			var range_list = result[5];
			for (var i = 0; i < range_list.length; i++) {
				if (parseInt(range_list[i], 10) === result[0]) {
					return (result[1][0] !== 'not');
				}
			}
			return (result[1][0] === 'not');
		}
		debug(' -- failed _in ');
		return null;
	}

	/*
	 * The difference between in and within is that in only includes integers in the specified range,
	 * while within includes all values.
	 */
	function within() {
		// within_relation = expr ('not')? 'within' range_list
		var result = sequence([expression, nOrMore(0, not), whitespace, _within_, whitespace, rangeList]);
		if (result !== null) {
			debug(' -- passed within');
			var range_list = result[5];
			if ((result[0] >= parseInt(range_list[0])) &&
				(result[0] < parseInt(range_list[range_list.length - 1]))) {
				return (result[1][0] !== 'not');
			}
			return (result[1][0] === 'not');
		}
		debug(' -- failed within ');
		return null;
	}

	// relation      = is_relation | in_relation | within_relation
	relation = choice([is, not_in, isnot, _in, within]);

	function and() {
		var result = sequence([relation, whitespace, _and_, whitespace, condition]);
		if (result) {
			debug(' -- passed and');
			return result[0] && result[4];
		}
		debug(' -- failed and');
		return null;
	}

	function or() {
		var result = sequence([relation, whitespace, _or_, whitespace, condition]);
		if (result) {
			debug(' -- passed or');
			return result[0] || result[4];
		}
		debug(' -- failed or');
		return null;
	}

	function sampleRangeTail() {
		// ',' range_list
		var result = sequence([_comma_, whitespace, samples]);
		if (result !== null) {
			return result[1];
		}
		debug(' -- failed sampleRangeTail');
		return null;
	}

	function condition() {
		var result = sequence([choice([and, or, relation])]);
		if (result) {
			return result[0];
		}
		return false;
	}

	function start() {
		return condition();
	}

	result = start();

	/*
	 * For success, the pos must have gotten to the end of the rule
	 * and returned a non-null.
	 * n.b. This is part of language infrastructure, so we do not throw an internationalizable message.
	 */
	if (result === null) {
		throw new Error('Parse error at position ' + pos.toString() + ' for rule: ' + rule);
	}

	if (pos !== rule.length) {
		console.log('Warning: Rule not parsed completely. Parser stopped at ' + rule.substr(0, pos) + ' for rule: ' + rule);
	}

	return result;
}

/* For module loaders, e.g. NodeJS, NPM */
if (typeof module !== 'undefined' && module.exports) {
	module.exports = pluralRuleParser;
}