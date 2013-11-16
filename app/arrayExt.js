Array.prototype.single = function(filter) {
	var matches = this.filter(filter);
	if (matches.length == 0) {
		throw new Error("Expected 1 but found 0");
	}
	if (matches.length > 1) {
		throw new Error("Expected 1 but found many");
	}

	return matches[0];
}

Array.prototype.singleOrNone = function(filter) {
	var matches = this.filter(filter);
	if (matches.length > 1) {
		throw new Error("Expected 1 but found many");
	}
	if (matches.length == 0) {
		return null;
	}

	return matches[0];
}